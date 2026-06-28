import escapeHtml from 'escape-html';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';

import dialogHelper from '../dialogHelper/dialogHelper';
import layoutManager from '../layoutManager';
import globalize from '../../lib/globalize';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-select/emby-select';
import '../formdialog.scss';
import template from './personEditor.template.html';

function centerFocus(elem, horiz, on) {
    import('../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        scrollHelper.centerFocus[fn](elem, horiz);
    });
}

// Wires a debounced typeahead onto the name input that suggests existing people (by name or
// alias) from the server, so users reuse an existing person rather than retyping/misspelling.
// Picking an existing person fills the exact canonical name (which is how the server links
// identity, since people are keyed by name+type) and records the matched id on the person.
function setupNameTypeahead(dlg, person, apiClient) {
    if (!apiClient) {
        return;
    }

    const input = dlg.querySelector('.txtPersonName');
    const datalist = dlg.querySelector('#personNameSuggestions');
    if (!input || !datalist) {
        return;
    }

    // Lowercased name -> person id, from the most recent suggestions.
    let suggestions = new Map();
    let debounceTimer;

    function applyMatchedId() {
        const id = suggestions.get((input.value || '').trim().toLowerCase());
        if (id) {
            person.Id = id;
        }
    }

    function query(term) {
        apiClient.getJSON(apiClient.getUrl('Persons', {
            searchTerm: term,
            limit: 20,
            userId: apiClient.getCurrentUserId()
        })).then(function (result) {
            const items = (result && result.Items) || [];
            suggestions = new Map(items.map(function (i) {
                return [(i.Name || '').toLowerCase(), i.Id];
            }));
            datalist.innerHTML = items.map(function (i) {
                return `<option value="${escapeHtml(i.Name || '')}"></option>`;
            }).join('');
            // The typed value may now exactly match a freshly fetched suggestion.
            applyMatchedId();
        }).catch(function () {
            // Suggestions are best-effort; ignore failures.
        });
    }

    input.addEventListener('input', function () {
        // A manual edit invalidates any previously linked identity until it matches again.
        person.Id = null;
        applyMatchedId();

        const term = (input.value || '').trim();
        clearTimeout(debounceTimer);
        if (term.length < 2) {
            datalist.innerHTML = '';
            suggestions = new Map();
            return;
        }

        debounceTimer = setTimeout(function () {
            query(term);
        }, 300);
    });
}

function show(person, apiClient) {
    return new Promise(function (resolve, reject) {
        const dialogOptions = {
            removeOnClose: true,
            scrollY: false
        };

        if (layoutManager.tv) {
            dialogOptions.size = 'fullscreen';
        } else {
            dialogOptions.size = 'small';
        }

        const dlg = dialogHelper.createDialog(dialogOptions);

        dlg.classList.add('formDialog');

        let html = '';
        let submitted = false;

        html += globalize.translateHtml(template, 'core');

        dlg.innerHTML = html;

        dlg.querySelector('.txtPersonName', dlg).value = person.Name || '';
        dlg.querySelector('.selectPersonType', dlg).value = person.Type || '';
        dlg.querySelector('.txtPersonRole', dlg).value = person.Role || '';

        setupNameTypeahead(dlg, person, apiClient);

        if (layoutManager.tv) {
            centerFocus(dlg.querySelector('.formDialogContent'), false, true);
        }

        dialogHelper.open(dlg);

        dlg.addEventListener('close', function () {
            if (layoutManager.tv) {
                centerFocus(dlg.querySelector('.formDialogContent'), false, false);
            }

            if (submitted) {
                resolve(person);
            } else {
                reject();
            }
        });

        let selectPersonTypeOptions = '';
        for (const type of Object.values(PersonKind)) {
            if (type === PersonKind.Unknown) {
                continue;
            }
            const selected = person.Type === type ? 'selected' : '';
            selectPersonTypeOptions += `<option value="${type}" ${selected}>\${${type}}</option>`;
        }
        dlg.querySelector('.selectPersonType').innerHTML = globalize.translateHtml(selectPersonTypeOptions);

        dlg.querySelector('.selectPersonType').addEventListener('change', function () {
            dlg.querySelector('.fldRole').classList.toggle(
                'hide',
                ![ PersonKind.Actor, PersonKind.GuestStar ].includes(this.value));
        });

        dlg.querySelector('.btnCancel').addEventListener('click', function () {
            dialogHelper.close(dlg);
        });

        dlg.querySelector('form').addEventListener('submit', function (e) {
            submitted = true;

            person.Name = dlg.querySelector('.txtPersonName', dlg).value;
            person.Type = dlg.querySelector('.selectPersonType', dlg).value;
            person.Role = dlg.querySelector('.txtPersonRole', dlg).value || null;

            dialogHelper.close(dlg);

            e.preventDefault();
            return false;
        });

        dlg.querySelector('.selectPersonType').dispatchEvent(new CustomEvent('change', {
            bubbles: true
        }));
    });
}

export default {
    show: show
};

