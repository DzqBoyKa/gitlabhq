<script>
import 'codemirror/lib/codemirror.css';
import '@toast-ui/editor/dist/toastui-editor.css';

import AddImageModal from './modals/add_image/add_image_modal.vue';
import { EDITOR_TYPES, EDITOR_HEIGHT, EDITOR_PREVIEW_STYLE, CUSTOM_EVENTS } from './constants';

import {
  registerHTMLToMarkdownRenderer,
  getEditorOptions,
  addCustomEventListener,
  removeCustomEventListener,
  addImage,
  getMarkdown,
} from './services/editor_service';

export default {
  components: {
    ToastEditor: () =>
      import(/* webpackChunkName: 'toast_editor' */ '@toast-ui/vue-editor').then(
        toast => toast.Editor,
      ),
    AddImageModal,
  },
  props: {
    content: {
      type: String,
      required: true,
    },
    options: {
      type: Object,
      required: false,
      default: () => null,
    },
    initialEditType: {
      type: String,
      required: false,
      default: EDITOR_TYPES.wysiwyg,
    },
    height: {
      type: String,
      required: false,
      default: EDITOR_HEIGHT,
    },
    previewStyle: {
      type: String,
      required: false,
      default: EDITOR_PREVIEW_STYLE,
    },
    imageRoot: {
      type: String,
      required: true,
      validator: prop => prop.endsWith('/'),
    },
  },
  data() {
    return {
      editorApi: null,
      previousMode: null,
    };
  },
  computed: {
    editorInstance() {
      return this.$refs.editor;
    },
  },
  created() {
    this.editorOptions = getEditorOptions(this.options);
  },
  beforeDestroy() {
    this.removeListeners();
  },
  methods: {
    addListeners(editorApi) {
      addCustomEventListener(editorApi, CUSTOM_EVENTS.openAddImageModal, this.onOpenAddImageModal);

      editorApi.eventManager.listen('changeMode', this.onChangeMode);
    },
    removeListeners() {
      removeCustomEventListener(
        this.editorApi,
        CUSTOM_EVENTS.openAddImageModal,
        this.onOpenAddImageModal,
      );

      this.editorApi.eventManager.removeEventHandler('changeMode', this.onChangeMode);
    },
    resetInitialValue(newVal) {
      this.editorInstance.invoke('setMarkdown', newVal);
    },
    onContentChanged() {
      this.$emit('input', getMarkdown(this.editorInstance));
    },
    onLoad(editorApi) {
      this.editorApi = editorApi;

      registerHTMLToMarkdownRenderer(editorApi);

      this.addListeners(editorApi);
    },
    onOpenAddImageModal() {
      this.$refs.addImageModal.show();
    },
    onAddImage({ imageUrl, altText, file }) {
      const image = { imageUrl, altText };

      if (file) {
        this.$emit('uploadImage', { file, imageUrl });
        // TODO - ensure that the actual repo URL for the image is used in Markdown mode
      }

      addImage(this.editorInstance, image);
    },
    onChangeMode(newMode) {
      this.$emit('modeChange', newMode);
    },
  },
};
</script>
<template>
  <div>
    <toast-editor
      ref="editor"
      :initial-value="content"
      :options="editorOptions"
      :preview-style="previewStyle"
      :initial-edit-type="initialEditType"
      :height="height"
      @change="onContentChanged"
      @load="onLoad"
    />
    <add-image-modal ref="addImageModal" :image-root="imageRoot" @addImage="onAddImage" />
  </div>
</template>
