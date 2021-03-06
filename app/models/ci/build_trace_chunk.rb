# frozen_string_literal: true

module Ci
  class BuildTraceChunk < ApplicationRecord
    extend ::Gitlab::Ci::Model
    include ::FastDestroyAll
    include ::Checksummable
    include ::Gitlab::ExclusiveLeaseHelpers

    belongs_to :build, class_name: "Ci::Build", foreign_key: :build_id

    default_value_for :data_store, :redis

    CHUNK_SIZE = 128.kilobytes
    WRITE_LOCK_RETRY = 10
    WRITE_LOCK_SLEEP = 0.01.seconds
    WRITE_LOCK_TTL = 1.minute

    FailedToPersistDataError = Class.new(StandardError)

    # Note: The ordering of this enum is related to the precedence of persist store.
    # The bottom item takes the highest precedence, and the top item takes the lowest precedence.
    enum data_store: {
      redis: 1,
      database: 2,
      fog: 3
    }

    class << self
      def all_stores
        @all_stores ||= self.data_stores.keys
      end

      def persistable_store
        # get first available store from the back of the list
        all_stores.reverse.find { |store| get_store_class(store).available? }
      end

      def get_store_class(store)
        @stores ||= {}
        @stores[store] ||= "Ci::BuildTraceChunks::#{store.capitalize}".constantize.new
      end

      ##
      # FastDestroyAll concerns
      def begin_fast_destroy
        all_stores.each_with_object({}) do |store, result|
          relation = public_send(store) # rubocop:disable GitlabSecurity/PublicSend
          keys = get_store_class(store).keys(relation)

          result[store] = keys if keys.present?
        end
      end

      ##
      # FastDestroyAll concerns
      def finalize_fast_destroy(keys)
        keys.each do |store, value|
          get_store_class(store).delete_keys(value)
        end
      end
    end

    def data
      @data ||= get_data.to_s
    end

    def truncate(offset = 0)
      raise ArgumentError, 'Offset is out of range' if offset > size || offset < 0
      return if offset == size # Skip the following process as it doesn't affect anything

      self.append("", offset)
    end

    def append(new_data, offset)
      raise ArgumentError, 'New data is missing' unless new_data
      raise ArgumentError, 'Offset is out of range' if offset < 0 || offset > size
      raise ArgumentError, 'Chunk size overflow' if CHUNK_SIZE < (offset + new_data.bytesize)

      in_lock(*lock_params) { unsafe_append_data!(new_data, offset) }

      schedule_to_persist! if full?
    end

    def size
      @size ||= @data&.bytesize || current_store.size(self) || data&.bytesize
    end

    def start_offset
      chunk_index * CHUNK_SIZE
    end

    def end_offset
      start_offset + size
    end

    def range
      (start_offset...end_offset)
    end

    def persist_data!
      in_lock(*lock_params) { unsafe_persist_data! }
    end

    def schedule_to_persist!
      return if persisted?

      Ci::BuildTraceChunkFlushWorker.perform_async(id)
    end

    private

    def get_data
      # Redis / database return UTF-8 encoded string by default
      current_store.data(self)&.force_encoding(Encoding::BINARY)
    end

    def unsafe_persist_data!(new_store = self.class.persistable_store)
      return if data_store == new_store.to_s

      current_data = data
      old_store_class = current_store

      unless current_data&.bytesize.to_i == CHUNK_SIZE
        raise FailedToPersistDataError, 'Data is not fulfilled in a bucket'
      end

      self.raw_data = nil
      self.data_store = new_store
      self.checksum = crc32(current_data)

      ##
      # We need to so persist data then save a new store identifier before we
      # remove data from the previous store to make this operation
      # trasnaction-safe. `unsafe_set_data! calls `save!` because of this
      # reason.
      #
      # TODO consider using callbacks and state machine to remove old data
      #
      unsafe_set_data!(current_data)

      old_store_class.delete_data(self)
    end

    def unsafe_set_data!(value)
      raise ArgumentError, 'New data size exceeds chunk size' if value.bytesize > CHUNK_SIZE

      current_store.set_data(self, value)

      @data = value
      @size = value.bytesize

      save! if changed?
    end

    def unsafe_append_data!(value, offset)
      new_size = value.bytesize + offset

      if new_size > CHUNK_SIZE
        raise ArgumentError, 'New data size exceeds chunk size'
      end

      current_store.append_data(self, value, offset).then do |stored|
        raise ArgumentError, 'Trace appended incorrectly' if stored != new_size
      end

      @data = nil
      @size = new_size

      save! if changed?
    end

    def persisted?
      !redis?
    end

    def live?
      redis?
    end

    def full?
      size == CHUNK_SIZE
    end

    def current_store
      self.class.get_store_class(data_store)
    end

    def lock_params
      ["trace_write:#{build_id}:chunks:#{chunk_index}",
       { ttl: WRITE_LOCK_TTL,
         retries: WRITE_LOCK_RETRY,
         sleep_sec: WRITE_LOCK_SLEEP }]
    end
  end
end
