const PromptsParams = {
    props: {
        selectedPrompt: {
            type: Object,
            default: {
                "name": "",
                "prompt": "",
                "examples": [],
            }
        },
        integrations: [],
        tags: [],
        isPromptLoading: false,
    },
    components: {
        PromptsVertexIntegration,
        PromptsOpenaiIntegration,
        PromptsAzureOpenaiIntegration,
        PromptsTagsModal,
        PromptsEditorName,
        PromptsEditorField,
    },
    data() {
        return {
            editablePrompt: {
                name: "",
                prompt: "",
                examples: [],
                model_settings: {},
            },
            testInput: '',
            testOutput: '',
            isRunClicked: false,
            selectedIntegration: "",
            selectedComponentInt: "",
            isRunLoading: false,
            isContextLoading: false,
            promptTags: [],
            showTagsModal: false,
            promptVersions: [],
            selectedPromptVersion: {
                id: null,
                version: 'latest',
            },
            newDescription: '',
        }
    },
    computed: {
        isInvalidContext() {
            return this.isRunClicked && !this.editablePrompt.prompt
        },
        isInvalidTestInput() {
            return this.isRunClicked && !this.testInput
        },
        isLatestVersion() {
            return this.selectedPrompt.version === 'latest';
        }
    },
    watch: {
        selectedPrompt: {
            handler: function (newVal, oldVal) {
                this.editablePrompt = Object.assign({}, newVal);
                if (newVal.model_settings) {
                    this.integrations.forEach(integration => {
                        if (integration.uid === newVal.integration_uid) {
                            this.selectedIntegration = integration.name;
                            this.selectedComponentInt = integration.name;
                            this.changeIntegration(integration.name)
                            this.$nextTick(() => {
                                $("#selectIntegration").val(integration.name).selectpicker('refresh')
                            })
                        }
                    })
                } else {
                    this.selectedComponentInt = "";
                    this.selectedIntegration = "";
                    this.$nextTick(() => {
                        $('#selectIntegration').val(newVal.id).selectpicker('refresh');
                    })
                }
                this.testInput = newVal.test_input ? newVal.test_input : "";
                this.testOutput = '';
                this.isRunClicked = false;
                this.fetchPromptTags(this.selectedPrompt.id);
                this.fetchPromptVersions(newVal.name);
                this.$nextTick(() => {
                    $('#promptsParamsTable').bootstrapTable('load', this.selectedPrompt.examples);
                    $('#variablesTable').bootstrapTable('load', this.selectedPrompt.variables);
                })
            },
            deep: true
        },
        selectedIntegration: {
            handler: function (newVal, oldVal) {
                if (!newVal) return
                this.changeIntegration(newVal)
            },
            deep: true
        },
    },
    mounted() {
        $('#promptsParamsTable').bootstrapTable();
        $('#variablesTable').bootstrapTable();
    },
    methods: {
        selectPromptVersion({ target: { value }}) {
            this.selectedPromptVersion = this.promptVersions.find(v => v.id === +value);
        },
        fetchPromptTags(promptId) {
            fetchPromptTagsAPI(promptId).then((tags) => {
                this.promptTags = tags;
            })
        },
        fetchPromptVersions(promptName) {
            fetchPromptVersionsAPI(promptName).then((prompts) => {
                this.promptVersions = prompts.map(({ id, version }) => ({ id, version }));
                this.selectedPromptVersion = this.promptVersions.find(v => v.id === this.selectedPrompt.id);
                this.$nextTick(() => {
                    $('#selectedPromptVersion').val(this.selectedPromptVersion.id).selectpicker('refresh');
                })
            })
        },
        changeIntegration(newVal) {
            if (this.selectedPrompt.integration_uid) {
                const existedInt = this.integrations
                    .find(integration => integration.name.toLowerCase() === newVal.toLowerCase())
                this.selectedComponentInt = newVal;
                if (existedInt.uid === this.selectedPrompt.integration_uid) {
                    this.editablePrompt.model_settings = { ...this.selectedPrompt.model_settings }
                    return;
                }
            }
            const integrationNames = this.integrations.map(integration => integration.name.toLowerCase());
            if (integrationNames.includes(newVal.toLowerCase())) {
                this.selectedComponentInt = newVal.toLowerCase();
            }
            this.editablePrompt.model_settings = this.integrations
                .find(integration => integration.name.toLowerCase() === newVal.toLowerCase()).settings

            this.selectedComponentInt = newVal;
        },
        addEmptyParamsRow()  {
            $('#promptsParamsTable').bootstrapTable(
                'append',
                {id: Date.now() + Math.floor(Math.random() * 1000),"input": "", "output": "", "action": ""}
            )
        },
        addEmptyVariableRow(){
            $('#variablesTable').bootstrapTable(
                'append',
                {id: Date.now() + Math.floor(Math.random() * 1000),"name": "", "value": "", "action": ""}
            )
        },
        checkFields(rowId) {
            const row = $('#promptsParamsTable').bootstrapTable('getRowByUniqueId', rowId)
            if (row.input && row.output) {
                $(`#promptsParamsTable tr[data-uniqueid=${rowId}]`).find('textarea').each(function () {
                    $(this).attr('disabled', 'disabled');
                })
                ApiCreateExample(this.editablePrompt.id, row.input, row.output).then(newRow => {
                    $('#promptsParamsTable')
                        .bootstrapTable('removeByUniqueId', rowId)
                        .bootstrapTable('append', newRow );
                    showNotify('SUCCESS', `Input/Output saved.`);
                })
            }
        },
        checkVariableFields(rowId) {
            const row = $('#variablesTable').bootstrapTable('getRowByUniqueId', rowId)
            if (row.name && row.value) {
                $(`#variablesTable tr[data-uniqueid=${rowId}]`).find('textarea').each(function () {
                    $(this).attr('disabled', 'disabled');
                })
                ApiCreateVariable(this.editablePrompt.id, row.name, row.value).then(newRow => {
                    $('#variablesTable')
                        .bootstrapTable('removeByUniqueId', rowId)
                        .bootstrapTable('append', newRow);
                    showNotify('SUCCESS', `Variable saved.`);
                })
            }
        },
        updateField(rowId, isChecked = null) {
            const row = $('#promptsParamsTable').bootstrapTable('getRowByUniqueId', rowId);
            ApiUpdateExampleField(this.editablePrompt.id, rowId, row.input, row.output, isChecked ?? row.is_active).then(data => {
                if (this.isLatestVersion) {
                    $(`#promptsParamsTable tr[data-uniqueid=${rowId}]`).find('textarea').each(function () {
                        $(this).removeAttr("disabled");
                    })
                }
                showNotify('INFO', `Input/Output updated.`);
            })
        },
        updateVariableField(rowId) {
            const row = $('#variablesTable').bootstrapTable('getRowByUniqueId', rowId)
            ApiUpdateVariableField(this.editablePrompt.id, rowId, row.name, row.value).then(data => {
                $(`#variablesTable tr[data-uniqueid=${rowId}]`).find('textarea').each(function () {
                    $(this).removeAttr("disabled");
                })
                showNotify('INFO', `Variable updated.`);
            })
            .catch(err => {
                $(`#variablesTable tr[data-uniqueid=${rowId}]`).find('textarea').each(function () {
                    $(this).removeAttr("disabled");
                })
                showNotify("ERROR", err)
            })
        },
        runTest() {
            this.isRunClicked = true;
            const integrationId = this.integrations.find(integration => integration.name === this.selectedIntegration)
            if (this.editablePrompt.prompt && this.testInput && this.selectedIntegration) {
                this.isRunLoading = true;
                ApiRunTest(this.editablePrompt, this.testInput, integrationId.uid).then(data => {
                    this.testOutput = data;
                }).catch(err => {
                    showNotify('ERROR', err)
                }).finally(() => {
                    this.isRunLoading = false;
                })
            }
        },
        updatePrompt(e) {
            this.editablePrompt.prompt = e.target.value;
            this.isContextLoading= true;
            ApiUpdatePrompt(this.editablePrompt).then(data => {
                this.isContextLoading = false;
                showNotify('SUCCESS', `Context updated.`)
            });
        },
        saveSettings() {
            ApiUpdatePrompt(this.editablePrompt).then(data => {
                showNotify('SUCCESS', `Settings updated.`)
            });
        },
        updateSetting(settings) {
            const settingsKeys = ['temperature', 'top_k', 'top_p', 'model_name', 'max_decode_steps', 'max_tokens'];
            const selectedSetting = {};
            for (const setting in settings) {
                if (settingsKeys.includes(setting)) {
                    selectedSetting[setting] = settings[setting];
                }
            }
            this.editablePrompt.integration_settings = Object.assign({}, selectedSetting);
        },
        addTestResult() {
            const rowId = Date.now() + Math.floor(Math.random() * 1000)
            $('#promptsParamsTable').bootstrapTable(
                'append',
                {id: rowId,"input": this.testInput, "output": this.testOutput, "action": ""}
            )
            this.checkFields(rowId)
        },
        showError(value) {
            return this.isRunClicked ? value.length > 0 : true;
        },
        hasError(value) {
            return value.length > 0;
        },
        deleteExample(exampleId) {
            ApiDeleteExample(exampleId).then(() => {
                showNotify('SUCCESS', 'Example delete.');
            });
        },
        deleteVariable(varId) {
            ApiDeleteVariable(varId).then(() => {
                showNotify('SUCCESS', 'Variable delete.');
            });
        },
        updateTags(tags) {
            this.editablePrompt.tags = tags;
        },
        LoadVersion() {
            vueVm.registered_components['prompts'].FetchPromptById(this.selectedPromptVersion.id);
        },
        deleteVersion() {
            ApiDeletePrompt(this.selectedPromptVersion.id).then(data => {
                showNotify('SUCCESS', 'Version delete.');
                const latestVersionId = this.promptVersions.find(v => v.version === 'latest').id;
                vueVm.registered_components['prompts'].FetchPromptById(latestVersionId);
            });
        }
    },
    template: `     
    <div class="d-flex">
        <div class="flex-grow-1 mr-3">
            <div class="card p-28">
                <div class="d-flex justify-content-between mb-2">
                    <promptsEditorName
                        v-show="!isPromptLoading"
                        :editable-prompt="editablePrompt"
                        v-model="editablePrompt.name">
                    </promptsEditorName>
                    <div class="d-flex">
                        <a class="btn btn-secondary mr-2" 
                            download
                            :class="{'disabled': isPromptLoading}"
                            :href="
                                $root.build_api_url('prompts', 'export_import') + 
                                '/' + $root.project_id + 
                                '/' + editablePrompt.id + 
                                '?as_file=true'"
                        >
                            Export
                        </a>
                        <button type="button" :disabled="isPromptLoading" 
                            class="btn btn-secondary mr-2" @click="$emit('open-create-version-modal')">
                            Save version
                        </button>
                        <button type="button" :disabled="isRunLoading || isPromptLoading" 
                            class="btn btn-basic d-flex align-items-center" @click="runTest">
                            Run
                            <i v-if="isRunLoading" class="preview-loader__white ml-2"></i>
                        </button>
                    </div>
                </div>
                <div class="position-relative" style="height: 164px" v-show="isPromptLoading">
                    <div class="layout-spinner">
                        <div class="spinner-centered">
                            <i class="spinner-loader__32x32"></i>
                        </div>
                    </div>
                </div>
                <div v-show="!isPromptLoading">
                    <promptsEditorField
                        title="Description"
                        :editable-prompt="editablePrompt"
                        v-model="editablePrompt.description">
                    </promptsEditorField>
                    <div>
                        <p class="font-h6 font-bold font-uppercase mb-1 text-gray-700 flex-grow-1">CONTEXT</p>
                        <div class="w-100">
                            <div class="custom-input w-100 position-relative" 
                                :class="{ 'invalid-input': isInvalidContext }">
                                <textarea
                                    :disabled="isContextLoading || !isLatestVersion"
                                    :value="editablePrompt.prompt"
                                    @change="updatePrompt"
                                    class="form-control password-mask" rows="5" id="SecretUpdateValue"></textarea>
                                    <div class="spinner__right-bottom" v-if="isContextLoading">
                                        <i class="spinner-loader__16x16"></i>
                                    </div>
                            </div>
                        </div>
                    </div>
                    <div class="mt-3">
                        <table 
                            id="variablesTable"
                            class="w-100 table-transparent mb-2 params-table"
                            data-toggle="table"
                            data-unique-id="id"
                        >
                            <thead class="thead-light">
                                <tr>
                                    <th data-field="id" data-visible="false"></th>
                                    <th data-field="name"
                                        data-formatter="VariableTable.textareaFormatter"
                                    >
                                        <span class="font-h6 font-semibold mr-2" style="color: var(--green)">Name</span>
                                        <span class="font-h5 font-weight-400 text-capitalize">Variable name</span>
                                    </th>
                                    <th data-field="value"
                                        data-formatter="VariableTable.textareaFormatter"
                                    >
                                        <span class="font-h6 font-semibold mr-2" style="color: var(--basic)">Value</span>
                                        <span class="font-h5 font-weight-400 text-capitalize">Variable value</span>
                                    </th>
                                    <th data-width="56" data-width-unit="px" 
                                        data-field="action"
                                        data-formatter="VariableTable.deleteFormatter"
                                    ></th>
                                </tr>
                            </thead>
                            <tbody style="border-bottom: solid 1px #EAEDEF">
                            </tbody>
                        </table>
                        <button type="button" class="btn btn-sm btn-secondary mt-2" 
                            :disabled="!isLatestVersion"
                            @click="addEmptyVariableRow">
                            <i class="fas fa-plus mr-2"></i>Add Variable
                        </button>
                    </div>
                </div>
            </div>    
            
            <div class="card mt-3 p-28">
                <p class="font-h5 font-bold font-uppercase">EXAMPLES</p>
                <div class="position-relative" style="height: 116px" v-show="isPromptLoading">
                    <div class="layout-spinner">
                        <div class="spinner-centered">
                            <i class="spinner-loader__32x32"></i>
                        </div>
                    </div>
                </div>
                <div v-show="!isPromptLoading">
                    <table 
                        id="promptsParamsTable"
                        class="w-100 table-transparent mb-2 params-table"
                        data-toggle="table"
                        data-unique-id="id"
                    >
                        <thead class="thead-light">
                            <tr>
                                <th data-field="id" data-visible="false"></th>
                                <th data-field="is_active"
                                    data-formatter="ParamsTable.cbxFormatter"
                                ></th>
                                <th data-field="input"
                                    data-formatter="ParamsTable.textareaFormatter"
                                >
                                    <span class="font-h6 font-semibold mr-2" style="color: var(--green)">Input</span>
                                    <span class="font-h5 font-weight-400 text-capitalize">Input condition or question.</span>
                                </th>
                                <th data-field="output"
                                    data-formatter="ParamsTable.textareaFormatter"
                                >
                                    <span class="font-h6 font-semibold mr-2" style="color: var(--basic)">Output</span>
                                    <span class="font-h5 font-weight-400 text-capitalize">Input expected result.</span>
                                </th>
                                <th data-width="56" data-width-unit="px"
                                    data-field="action"
                                    data-formatter="ParamsTable.parametersDeleteFormatter"
                                ></th>
                            </tr>
                        </thead>
                        <tbody style="border-bottom: solid 1px #EAEDEF">
                        </tbody>
                    </table>
                    <button type="button" class="btn btn-sm btn-secondary mt-2" 
                        :disabled="!isLatestVersion"
                        @click="addEmptyParamsRow">
                        <i class="fas fa-plus mr-2"></i>Add Parameter
                    </button>
                </div>
            </div>
            
            <div class="card mt-3 p-28">
                <div class="d-flex justify-content-between mb-2">
                    <p class="font-h5 font-bold font-uppercase">TESTS</p>
                    <button type="button" :disabled="isRunLoading || isPromptLoading" 
                        class="btn btn-basic d-flex align-items-center" @click="runTest">
                        Run
                        <i v-if="isRunLoading" class="preview-loader__white ml-2"></i>
                    </button>
                </div>
                <div class="position-relative" style="height: 188px" v-if="isPromptLoading">
                    <div class="layout-spinner">
                        <div class="spinner-centered">
                            <i class="spinner-loader__32x32"></i>
                        </div>
                    </div>
                </div>
                <div v-else>
                    <table 
                        class="w-100 table-transparent mb-2 params-table" 
                        id="testResult">
                        <thead class="thead-light">
                            <tr>
                                <th data-field="inputTest"
                                    >
                                    <span class="font-h6 font-semibold mr-2" style="color: var(--green)">Input</span>
                                    <span class="font-h5 font-weight-400 text-capitalize">Input condition or question.</span>
                                </th>
                                <th data-field="outputTest"
                                >
                                    <span class="font-h6 font-semibold mr-2" style="color: var(--basic)">Output</span>
                                    <span class="font-h5 font-weight-400 text-capitalize">Input expected result.</span>
                                </th>
                                <th data-width="56" data-width-unit="px" 
                                    data-field="action"
                                    data-formatter="ParamsTable.parametersDeleteFormatter"
                                ></th>
                            </tr>
                        </thead>
                        <tbody style="border-bottom: solid 1px #EAEDEF">
                            <tr>
                                <td class="p-2">
                                    <div class="custom-input" :class="{ 'invalid-input': isInvalidTestInput }">
                                        <textarea type="text" class="form-control form-control-alternative"
                                            rows="5"
                                            v-model="testInput">
                                        </textarea>
                                        <div class="invalid-tooltip invalid-tooltip-custom"></div>
                                    </div>
                                </td>
                                <td class="p-2">
                                    <div>
                                        <textarea disabled type="text"
                                            rows="5"
                                            style="color: var(--green)"
                                            v-model="testOutput"
                                            class="form-control form-control-alternative">
                                        </textarea>
                                        <div class="invalid-tooltip invalid-tooltip-custom"></div>
                                    </div>
                                </td>
                                <td style="width: 56px;" class="p-2">
                                    <button :disabled="!testOutput || !testInput" 
                                        class="btn btn-default btn-xs btn-table btn-icon__xs prompt_setting" @click="addTestResult">
                                        <i class="icon__14x14 icon-add-column"></i>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div class="card p-4" style="min-width: 340px">
            <div class="d-flex justify-content-between">
                <p class="font-h4 font-bold">Settings</p>
            </div>
            <div class="position-relative h-100" v-if="isPromptLoading">
                <div class="layout-spinner">
                    <div class="spinner-centered">
                        <i class="spinner-loader__32x32"></i>
                    </div>
                </div>
            </div>
            <template v-else>
                <div class="select-validation mt-4">
                    <p class="font-h5 font-semibold mb-1">Select version</p>
                    <select id="selectedPromptVersion" class="selectpicker bootstrap-select__b bootstrap-select__b-sm" 
                        @change="selectPromptVersion"
                        data-style="btn">
                        <option v-for="version in promptVersions" :value="version.id">{{ version.version }}</option>
                    </select>
                    <div class="d-flex justify-content-between">
                        <button type="button"
                            class="btn btn-basic d-flex align-items-center justify-content-center mt-1 flex-grow-1 mr-1" @click="LoadVersion">
                            Load version
                        </button>
                        <button type="button"
                            :disabled="selectedPromptVersion.version === 'latest'"
                            class="btn btn-secondary d-flex align-items-center mt-1" @click="deleteVersion">
                            Delete version
                        </button>
                    </div>
                </div>
                <div class="d-flex mt-4 flex-column">
                    <div>
                        <span class="font-h6 font-bold mr-2">TAGS:</span>
                        <button class="btn btn-xs btn-painted mr-1 rounded-pill mb-1" v-for="tag in editablePrompt.tags"
                            :style="{'--text-color': tag.color, '--brd-color': tag.color}">{{tag.tag}}
                        </button>
                    </div>
                    <div class="d-flex mt-1">
                        <button type="button" class="btn btn-default btn-xs btn-icon__xs mr-2"
                            @click="showTagsModal = true">
                            <i class="icon__18x18 icon-edit" data-toggle="tooltip" data-placement="top" title="Edit tags"></i>
                        </button>
                        <p class="font-h5">Edit tags</p>
                    </div>
                </div>
                <div class="select-validation mt-4" :class="{'invalid-select': !showError(selectedIntegration)}">
                    <p class="font-h5 font-semibold mb-1">Select integration</p>
                    <select id="selectIntegration" class="selectpicker bootstrap-select__b bootstrap-select__b-sm" 
                        v-model="selectedIntegration"
                        data-style="btn">
                        <option v-for="integration in integrations" :value="integration.name">{{ integration.config.name }}</option>
                    </select>
                    <span class="input_error-msg">Integration is require.</span>
                </div>
                <PromptsVertexIntegration 
                    :is-run-clicked="isRunClicked"
                    :selected-prompt="editablePrompt"
                    @update-setting="updateSetting"
                    :key="selectedPrompt"
                    v-if="selectedIntegration === 'vertex_ai'">
                </PromptsVertexIntegration>
                <PromptsOpenaiIntegration 
                    :is-run-clicked="isRunClicked"
                    :selected-prompt="editablePrompt"
                    @update-setting="updateSetting"
                    :key="selectedPrompt"
                    v-if="selectedIntegration === 'open_ai'">
                </PromptsOpenaiIntegration>
                <PromptsAzureOpenaiIntegration 
                    :is-run-clicked="isRunClicked"
                    :selected-prompt="editablePrompt"
                    @update-setting="updateSetting"
                    :key="selectedPrompt"
                    v-if="selectedIntegration === 'open_ai_azure'">
                </PromptsAzureOpenaiIntegration>
                <transition>
                    <prompts-tags-modal
                        v-if="showTagsModal"
                        :prompt="editablePrompt"
                        @update-tags="updateTags"
                        @close-modal="showTagsModal = false"
                    >  
                    </prompts-tags-modal>
                </transition>
            </template>
        </div>
    </div>  
    `
}

register_component('prompts-params', PromptsParams);
