import Vue from 'vue';
import eventHub from './event_hub';
import issuableApp from './components/app.vue';
import '../vue_shared/vue_resource_interceptor';

document.addEventListener('DOMContentLoaded', () => {
  const initialDataEl = document.getElementById('js-issuable-app-initial-data');
  const initialData = JSON.parse(initialDataEl.innerHTML.replace(/&quot;/g, '"'));
  $('.issuable-edit').on('click', (e) => {
    e.preventDefault();

    eventHub.$emit('open.form');
  });

  return new Vue({
    el: document.getElementById('js-issuable-app'),
    components: {
      issuableApp,
    },
    data() {
      const issuableElement = this.$options.el;
      const issuableTitleElement = issuableElement.querySelector('.title');
      const issuableDescriptionElement = issuableElement.querySelector('.wiki');
      const issuableDescriptionTextarea = issuableElement.querySelector('.js-task-list-field');
      const {
        canUpdate,
        canDestroy,
        canMove,
        endpoint,
        issuableRef,
        isConfidential,
        markdownPreviewUrl,
        markdownDocs,
        projectsAutocompleteUrl,
      } = issuableElement.dataset;

      return {
        canUpdate: gl.utils.convertPermissionToBoolean(canUpdate),
        canDestroy: gl.utils.convertPermissionToBoolean(canDestroy),
        canMove: gl.utils.convertPermissionToBoolean(canMove),
        endpoint,
        issuableRef,
        initialTitle: issuableTitleElement.innerHTML,
        initialDescriptionHtml: issuableDescriptionElement ? issuableDescriptionElement.innerHTML : '',
        initialDescriptionText: issuableDescriptionTextarea ? issuableDescriptionTextarea.textContent : '',
        isConfidential: gl.utils.convertPermissionToBoolean(isConfidential),
        markdownPreviewUrl,
        markdownDocs,
        projectPath: initialData.project_path,
        projectNamespace: initialData.namespace_path,
        projectsAutocompleteUrl,
        issuableTemplates: initialData.templates,
      };
    },
    render(createElement) {
      return createElement('issuable-app', {
        props: {
          canUpdate: this.canUpdate,
          canDestroy: this.canDestroy,
          canMove: this.canMove,
          endpoint: this.endpoint,
          issuableRef: this.issuableRef,
          initialTitle: this.initialTitle,
          initialDescriptionHtml: this.initialDescriptionHtml,
          initialDescriptionText: this.initialDescriptionText,
          issuableTemplates: this.issuableTemplates,
          isConfidential: this.isConfidential,
          markdownPreviewUrl: this.markdownPreviewUrl,
          markdownDocs: this.markdownDocs,
          projectPath: this.projectPath,
          projectNamespace: this.projectNamespace,
          projectsAutocompleteUrl: this.projectsAutocompleteUrl,
        },
      });
    },
  });
});
