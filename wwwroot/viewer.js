
import ShowIssuesExtension from './extension/showIssuesExtension.js';
import CreatePushpinExtension from './extension/createPushpinExtension.js';
import CustomSectionExtension from './extension/customSectionExtension.js';


export async function getMyAccesToken(){
    try {
        const resp = await fetch('/api/auth/token');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const { access_token, expires_in } = await resp.json();
        return { access_token, expires_in };
    } catch (err) {
        alert('Could not obtain access token. See the console for more details.');
        console.error(err);
    }
}

async function getAccessToken(callback) {
    try {
        const { access_token, expires_in } = await getMyAccesToken();
        callback(access_token, expires_in);
    } catch (err) {
        alert('Could not obtain access token. See the console for more details.');
        console.error(err);
    }
}


export function initViewer(container) {
    return new Promise(function (resolve, reject) {
        Autodesk.Viewing.Initializer({ env: 'AutodeskProduction', getAccessToken }, function () {
            const config = {
                extensions: ['Autodesk.DocumentBrowser', 'ShowIssuesExtension', 'CreatePushpinExtension', 'Autodesk.Section']
            };
            const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
            viewer.start();
            viewer.loadExtension('ShowIssuesExtension', ShowIssuesExtension)
            viewer.loadExtension('CreatePushpinExtension', CreatePushpinExtension)
            viewer.loadExtension('CustomSectionExtension', CustomSectionExtension)
            viewer.loadExtension('Autodesk.Section');
            viewer.setTheme('light-theme');
            viewer.setBackgroundColor(255, 255, 255, 255, 255, 255);
            viewer.setLightPreset(0);
            resolve(viewer);
        });
    });
}

export function loadModel(viewer, urn, options = {}) {
    return new Promise(function (resolve, reject) {
        function onDocumentLoadSuccess(doc) {
            const viewable = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewable, options)
                .then(model => resolve(model)) // só resolve quando o modelo estiver pronto
                .catch(reject);
        }

        function onDocumentLoadFailure(code, message, errors) {
            reject({ code, message, errors });
        }

        viewer.setLightPreset(0);
        Autodesk.Viewing.Document.load('urn:' + urn, onDocumentLoadSuccess, onDocumentLoadFailure);
    });
}
