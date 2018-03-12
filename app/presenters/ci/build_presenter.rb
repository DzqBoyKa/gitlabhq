module Ci
  class BuildPresenter < Gitlab::View::Presenter::Delegated
    presents :build

    def erased_by_user?
      # Build can be erased through API, therefore it does not have
      # `erased_by` user assigned in that case.
      erased? && erased_by
    end

    def erased_by_name
      erased_by.name if erased_by_user?
    end

    def status_title
      if auto_canceled?
        "Job is redundant and is auto-canceled by Pipeline ##{auto_canceled_by_id}"
      end
    end

    def trigger_variables
      return [] unless trigger_request

      @trigger_variables ||=
        if pipeline.variables.any?
          pipeline.variables.map(&:to_runner_variable)
        else
          trigger_request.user_variables
        end
    end

    def failure_reason_description
      failure_descriptions[failure_reason]
    end

    private

    def failure_descriptions
      {
        "unknown_failure" => "Unknown failure",
        "script_failure" => "Script failure",
        "api_failure" => "API failure",
        "stuck_or_timeout_failure" => "Stuck or timeout failure",
        "runner_system_failure" => "Runner system failure",
        "missing_dependency_failure" => "Missing dependency failure"
      }
    end
  end
end
