import { nextTick } from 'vue';
import Vuex from 'vuex';
import { createLocalVue, shallowMount } from '@vue/test-utils';
import { GlLoadingIcon, GlButton } from '@gitlab/ui';
import state from '~/import_projects/store/state';
import * as getters from '~/import_projects/store/getters';
import { STATUSES } from '~/import_projects/constants';
import ImportProjectsTable from '~/import_projects/components/import_projects_table.vue';
import ProviderRepoTableRow from '~/import_projects/components/provider_repo_table_row.vue';
import PageQueryParamSync from '~/import_projects/components/page_query_param_sync.vue';

describe('ImportProjectsTable', () => {
  let wrapper;

  const findFilterField = () =>
    wrapper.find('input[data-qa-selector="githubish_import_filter_field"]');

  const providerTitle = 'THE PROVIDER';
  const providerRepo = { id: 10, sanitizedName: 'sanitizedName', fullName: 'fullName' };

  const findImportAllButton = () =>
    wrapper
      .findAll(GlButton)
      .filter(w => w.props().variant === 'success')
      .at(0);

  const importAllFn = jest.fn();
  const setPageFn = jest.fn();

  function createComponent({
    state: initialState,
    getters: customGetters,
    slots,
    filterable,
    paginatable,
  } = {}) {
    const localVue = createLocalVue();
    localVue.use(Vuex);

    const store = new Vuex.Store({
      state: { ...state(), ...initialState },
      getters: {
        ...getters,
        ...customGetters,
      },
      actions: {
        fetchRepos: jest.fn(),
        fetchJobs: jest.fn(),
        fetchNamespaces: jest.fn(),
        importAll: importAllFn,
        stopJobsPolling: jest.fn(),
        clearJobsEtagPoll: jest.fn(),
        setFilter: jest.fn(),
        setPage: setPageFn,
      },
    });

    wrapper = shallowMount(ImportProjectsTable, {
      localVue,
      store,
      propsData: {
        providerTitle,
        filterable,
        paginatable,
      },
      slots,
    });
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.destroy();
      wrapper = null;
    }
  });

  it('renders a loading icon while repos are loading', () => {
    createComponent({ state: { isLoadingRepos: true } });

    expect(wrapper.find(GlLoadingIcon).exists()).toBe(true);
  });

  it('renders a loading icon while namespaces are loading', () => {
    createComponent({ state: { isLoadingNamespaces: true } });

    expect(wrapper.find(GlLoadingIcon).exists()).toBe(true);
  });

  it('renders a table with provider repos', () => {
    const repositories = [
      { importSource: { id: 1 }, importedProject: null },
      { importSource: { id: 2 }, importedProject: { importStatus: STATUSES.FINISHED } },
      { importSource: { id: 3, incompatible: true }, importedProject: {} },
    ];

    createComponent({
      state: { namespaces: [{ fullPath: 'path' }], repositories },
    });

    expect(wrapper.find(GlLoadingIcon).exists()).toBe(false);
    expect(wrapper.find('table').exists()).toBe(true);
    expect(
      wrapper
        .findAll('th')
        .filter(w => w.text() === `From ${providerTitle}`)
        .exists(),
    ).toBe(true);

    expect(wrapper.findAll(ProviderRepoTableRow)).toHaveLength(repositories.length);
  });

  it.each`
    hasIncompatibleRepos | buttonText
    ${false}             | ${'Import all repositories'}
    ${true}              | ${'Import all compatible repositories'}
  `(
    'import all button has "$buttonText" text when hasIncompatibleRepos is $hasIncompatibleRepos',
    ({ hasIncompatibleRepos, buttonText }) => {
      createComponent({
        state: {
          providerRepos: [providerRepo],
        },
        getters: {
          hasIncompatibleRepos: () => hasIncompatibleRepos,
        },
      });

      expect(findImportAllButton().text()).toBe(buttonText);
    },
  );

  it('renders an empty state if there are no projects available', () => {
    createComponent({ state: { repositories: [] } });

    expect(wrapper.find(ProviderRepoTableRow).exists()).toBe(false);
    expect(wrapper.text()).toContain(`No ${providerTitle} repositories found`);
  });

  it('sends importAll event when import button is clicked', async () => {
    createComponent({ state: { providerRepos: [providerRepo] } });

    findImportAllButton().vm.$emit('click');
    await nextTick();

    expect(importAllFn).toHaveBeenCalled();
  });

  it('shows loading spinner when import is in progress', () => {
    createComponent({ getters: { isImportingAnyRepo: () => true } });

    expect(findImportAllButton().props().loading).toBe(true);
  });

  it('renders filtering input field by default', () => {
    createComponent();

    expect(findFilterField().exists()).toBe(true);
  });

  it('does not render filtering input field when filterable is false', () => {
    createComponent({ filterable: false });

    expect(findFilterField().exists()).toBe(false);
  });

  describe('when paginatable is set to true', () => {
    const pageInfo = { page: 1 };

    beforeEach(() => {
      createComponent({
        state: {
          namespaces: [{ fullPath: 'path' }],
          pageInfo,
          repositories: [
            { importSource: { id: 1 }, importedProject: null, importStatus: STATUSES.NONE },
          ],
        },
        paginatable: true,
      });
    });

    it('passes current page to page-query-param-sync component', () => {
      expect(wrapper.find(PageQueryParamSync).props().page).toBe(pageInfo.page);
    });

    it('dispatches setPage when page-query-param-sync emits popstate', () => {
      const NEW_PAGE = 2;
      wrapper.find(PageQueryParamSync).vm.$emit('popstate', NEW_PAGE);

      const { calls } = setPageFn.mock;

      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toBe(NEW_PAGE);
    });
  });

  it.each`
    hasIncompatibleRepos | shouldRenderSlot | action
    ${false}             | ${false}         | ${'does not render'}
    ${true}              | ${true}          | ${'render'}
  `(
    '$action incompatible-repos-warning slot if hasIncompatibleRepos is $hasIncompatibleRepos',
    ({ hasIncompatibleRepos, shouldRenderSlot }) => {
      const INCOMPATIBLE_TEXT = 'INCOMPATIBLE!';

      createComponent({
        getters: {
          hasIncompatibleRepos: () => hasIncompatibleRepos,
        },

        slots: {
          'incompatible-repos-warning': INCOMPATIBLE_TEXT,
        },
      });

      expect(wrapper.text().includes(INCOMPATIBLE_TEXT)).toBe(shouldRenderSlot);
    },
  );
});
