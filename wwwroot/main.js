import { initViewer, loadModel, getMyAccesToken } from './viewer.js';

initViewer(document.getElementById('preview')).then(viewer => {
    setupModelSelection(viewer);
    setupListMetadata(viewer);
    // setupModelUpload(viewer);
    setupClearViewerButton(viewer);
});

async function setupClearViewerButton(viewer) {
    const clearButton = document.getElementById('clear-viewer');
    clearButton.addEventListener('click', () => {
        if (loadedUrns.size > 0) {
            for (const model of loadedUrns.values()) {
                viewer.unloadModel(model);
            }
            loadedUrns.clear();
        }

        viewer.impl.invalidate(true, true, true);
    });
}

let lastInsertedModelUrn = null;


async function setupModelSelection(viewer) {
    try {
        const resp = await fetch('/api/models');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        let models = await resp.json();
        models.sort((a, b) => a.name.localeCompare(b.name));

        updateSidebarModelList(models, viewer);

        if( models.length !== 0 && models.length >= 5) {
            const model_one = models[0];
            const model_two = models[1];
            const model_three = models[2];
            // const model_four = models[3];
            // const model_five = models[4];
    
            loadUrnToViewer(model_one.urn, viewer);
            loadUrnToViewer(model_two.urn, viewer);
            loadUrnToViewer(model_three.urn, viewer);
            // loadUrnToViewer(model_four.urn, viewer);
            // loadUrnToViewer(model_five.urn, viewer);
        }


    } catch (err) {
        alert('Could not list models. See the console for more details.');
        console.error(err);
    }
}


async function setupListMetadata(viewer){
    const upload = document.getElementById('upload');

    upload.onclick = () => {
        loadedUrns.forEach(async (model, urn) => {
            await getModelMetadata(urn);
        });
    }

}

async function setupModelUpload(viewer) {
    const upload = document.getElementById('upload');
    const input = document.getElementById('input');
    // const models = document.getElementById('models');
    upload.onclick = () => input.click();
    input.onchange = async () => {
        const file = input.files[0];
        let data = new FormData();
        data.append('model-file', file);
        if (file.name.endsWith('.zip')) { // When uploading a zip file, ask for the main design file in the archive
            const entrypoint = window.prompt('Please enter the filename of the main design inside the archive.');
            data.append('model-zip-entrypoint', entrypoint);
        }
        upload.setAttribute('disabled', 'true');
        // models.setAttribute('disabled', 'true');
        showNotification(`Uploading model <em>${file.name}</em>. Do not reload the page.`);
        try {
            const resp = await fetch('/api/models', { method: 'POST', body: data });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            const model = await resp.json();
            setupModelSelection(viewer, model.urn);
        } catch (err) {
            alert(`Could not upload model ${file.name}. See the console for more details.`);
            console.error(err);
        } finally {
            clearNotification();
            upload.removeAttribute('disabled');
            // models.removeAttribute('disabled');
            input.value = '';
        }
    };
}

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `<div class="notification">${message}</div>`;
    overlay.style.display = 'flex';
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
    overlay.style.display = 'none';
}

let loadedUrns = new Map();

async function getModelMetadata(urn){

    const token = await getMyAccesToken();
    console.log('Access Token:', token);

    const metadata2 = await fetch(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/metadata`, 
        {
            headers:{
                Authorization: `Bearer ${token.access_token}`
            }
        })

    const response = await metadata2.json();
        
    console.log('Metadata for model:', response);

    const guid = response.data.metadata[0].guid;
    console.log('GUID:', guid);

    const metadata3 = await fetch(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/metadata/${guid}/properties`, 
    {
        headers:{
            Authorization: `Bearer ${token.access_token}`
        }
    })

    // TODO
    // if first response is 202:
    //      method to make request until its 200

    console.log('Metadata for model:', await metadata3.json());

}

async function loadUrnToViewer(urn, viewer){
    try {
        showNotification(`Loading model ${urn}...`);

        // await getModelMetadata(urn);
        
        const accessToken = await getMyAccesToken();
        if (!accessToken) {
            throw new Error('Could not obtain access token');
        }

        const isFirstModel = loadedUrns.size === 0;
        let loadedCleanModel = null;

        if(isFirstModel) {
            const primaryModel = await loadModel(viewer, urn,{
                globalOffset: { x: 0, y: 0, z: 0 },// refGlobalOffset,
                placementTransform: new THREE.Matrix4(),// refPlacement,
                applyRefPoint: true,
                keepCurrentModels: true
            });
            loadedUrns.set(urn, primaryModel);
        }else{
            const loadOptions = {

                globalOffset: { x: 0, y: 0, z: 0 },
                placementTransform: new THREE.Matrix4(),
                applyRefPoint: true,
                keepCurrentModels: true
            };

            const model = await addViewableWithToken(viewer, urn, accessToken.access_token, loadOptions.placementTransform, loadOptions.globalOffset);
            loadedUrns.set(urn, model);
        }

        lastInsertedModelUrn = urn;
        clearNotification();
        viewer.showAll();
        
    } catch (err) {
        console.error(`Error loading model ${urn}:`, err);
        alert(`Failed to load model: ${err.message}`);
    }
}

function updateSidebarModelList(models, viewer) {
    const listContainer = document.getElementById('model-list');
    models.sort((a, b) => a.name.localeCompare(b.name));

    listContainer.innerHTML = models.map(model => `
        <div data-urn="${model.urn}">
            <label class="checkbox-label" data-urn="${model.urn}">
                <input type="checkbox" value="${model.urn}">
                ${model.name}
            </label>
        </div>
    `).join('\n');

    listContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (event) => {
            const urn = event.target.value;
    
            if (event.target.checked) {
                if (!loadedUrns.has(urn)) {
                    loadUrnToViewer(urn, viewer);
                }
            } else {
                const model = loadedUrns.get(urn);
                if (model) {
                    try {
                        viewer.unloadModel(model);
                        loadedUrns.delete(urn);
                        console.log(`Successfully unloaded ${urn}`);
                    } catch (err) {
                        console.error(`Failed to unload ${urn}:`, err);
                    }
                }
            }
        });
    });
}

async function addViewableWithToken(viewer, urn, accessToken, xform, offset) {
    return new Promise((resolve, reject) => {
        // Troca o token antes de carregar o modelo
        Autodesk.Viewing.endpoint.HTTP_REQUEST_HEADERS = {
            Authorization: `Bearer ${accessToken}`
        };

        Autodesk.Viewing.Document.load(
            "urn:" + urn,
            (doc) => {
                const viewable = doc.getRoot().getDefaultGeometry();
                const options = {
                    keepCurrentModels: true,
                    applyRefPoint: true,
                };
                if (xform) options.placementTransform = xform;
                if (offset) options.globalOffset = offset;

                viewer
                    .loadDocumentNode(doc, viewable, options)
                    .then(model => {
                        resolve(model);
                    })
                    .catch(reject);
            },
            (error) => {
                reject(`Erro ao carregar documento ${urn}: ${error}`);
            }
        );
    });
}



