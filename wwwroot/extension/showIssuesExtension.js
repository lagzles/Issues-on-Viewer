export default class ShowIssuesExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this.panel = null;
    this.viewer = viewer;
    this.currentSelectionTool = null;
  }

  load() {
    this.createToolbarButton();
    return true;
  }

  unload() {
    if (this.panel) {
      this.panel.setVisible(false);
    }
    if (this.button) {
      this.viewer.toolbar.removeControl(this.button);
    }
    return true;
  }

  createToolbarButton() {
    const viewer = this.viewer;
    const _this = this;

    function createUI() {
      _this.button = new Autodesk.Viewing.UI.Button('showIssuesBtn');
      _this.button.setToolTip('Show Issues');
      _this.button.setIcon('adsk-icon-properties');
      _this.button.onClick = () => {
        _this.showSearchPanel();
      };

      const subToolbar = new Autodesk.Viewing.UI.ControlGroup('issueManagerToolbar');
      subToolbar.addControl(_this.button);
      viewer.toolbar.addControl(subToolbar);
    }

    if (viewer.toolbar) {
      createUI();
    } else {
      viewer.addEventListener(Autodesk.Viewing.TEXTURES_LOADED_EVENT, createUI);
    }
  }

  showSearchPanel() {
    this.panel = new IssueManagerPanel(this, 'IssueManagerPanel', 'Mostrar Issues', this.viewer);
    this.panel.setVisible(true);
  }
}

// Cor relacionada ao status
const STATUS_COLORS = {
    'Open': '#ff4d4d',          // vermelho
    'Closed': '#4caf50',        // verde
    'In Progress': '#ff9800',   // laranja
    'Resolved': '#2196f3',      // azul
    'Critical': '#e91e63'       // rosa escuro
};
class IssueManagerPanel extends Autodesk.Viewing.UI.DockingPanel {
  constructor(extension, id, title, viewer, options = {}) {
    super(viewer.container, id, title);
    this.extension = extension;
    this.viewer = viewer;

    this.container.style.left = (options.x || 10) + 'px';
    this.container.style.top = (options.y || 10) + 'px';
    this.container.style.width = (options.width || 350) + 'px';
    // this.container.style.height = (options.height || 250) + 'px';
    this.container.style.flex = '1'
    this.container.style.resize = 'none';
    this.container.classList.add('docking-panel-container-solid-color');
    this.footer=null;

    this.finishedSearching = false;

    this.issue_meshes = [];


    setTimeout(async () => {
        await this.getIssues();
        this.initDragInteraction();
     }, 0);


  }

    initialize() {
        this.title = this.createTitleBar(this.titleLabel || this.container.id);
        this.initializeMoveHandlers(this.title);
        this.container.appendChild(this.title);

        // Panel body
        this.body = document.createElement('div');
        this.body.className = 'docking-panel-body';
        this.body.style.padding = '10px';
        this.body.style.overflowY = 'auto';
        this.body.style.backgroundColor = '#fff';
        this.container.appendChild(this.body);


        // Results count
        this.resultsCount = document.createElement('div');
        this.resultsCount.className = 'results-count';
        this.resultsCount.style.marginBottom = '10px';
        this.resultsCount.style.fontSize = '12px';
        this.resultsCount.style.color = '#666';
        this.body.appendChild(this.resultsCount);

        // Results list
        this.resultsList = document.createElement('div');
        this.resultsList.className = 'results-list';
        this.resultsList.style.maxHeight = '200px';
        this.resultsList.style.overflowY = 'auto';
        this.resultsList.style.border = '1px solid #ddd';
        this.resultsList.style.padding = '5px';
        this.body.appendChild(this.resultsList);

        // Footer with close button
        const footer = document.createElement('div');
        footer.style.padding = '10px';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.backgroundColor = '#f0f0f0';
        footer.style.borderTop = '1px solid #ccc';
        this.footer = footer;

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.padding = '6px 12px';
        closeButton.style.border = '1px solid #ccc';
        closeButton.style.borderRadius = '4px';
        closeButton.style.backgroundColor = '#f0f0f0';
        closeButton.onclick = () => {
            this.closePanel();
        };
        footer.appendChild(closeButton);

        this.container.appendChild(footer);
    }

    destroy() {

        this.removeMeshes();
        if (typeof this.uninitialize === 'function') {
            this.uninitialize();
        }
        this.container = null;
        this.content = null;
        this.title = null;
    }


    removeMeshes(){
        const overlayName = 'issues-overlay';
        if (this.issue_meshes.length > 0) {
            this.issue_meshes.forEach(mesh => {
                let child = this.viewer.impl.scene.children.find(m => m.name === mesh.name);

                if(child){
                    this.viewer.impl.scene.remove(child);
                }

                this.viewer.impl.scene.remove(mesh);
                this.viewer.overlays.removeMesh(mesh, overlayName);

                this.viewer.impl.invalidate(true); // Forçar atualização do viewer
            });
            this.issue_meshes = [];
        }

        if (this.viewer.overlays.hasScene(overlayName)) {
            this.viewer.overlays.clearScene(overlayName);
        }


        if (this.cameraCallback) {
            this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.cameraCallback);
            this.cameraCallback = null;
        }

        if (this.onMeshClick) {
            this.viewer.canvas.removeEventListener('click', this.onMeshClick);
            this.onMeshClick = null;
        }

        if (this.boundOnPointerDown) {
            this.viewer.container.removeEventListener('pointerdown', this.boundOnPointerDown);
            this.boundOnPointerDown = null;
        }


    }
        
    closePanel() {
        console.log("closePanel")
        this.removeMeshes();
        this.destroy();
        if (this.extension) this.extension.panel = null;
    }

    async getIssues(){
        try{
            const response = await fetch('/api/issues');
            if (!response.ok) {
                throw new Error('Erro ao buscar issues');
            }
            const data = await response.json();
            const issues = data.issues || [];

            this.displayResults(issues);

        }catch(error){
            console.error("Error fetching issues:", error);
            this.resultsList.innerHTML = 'Error fetching issues';
            return;
        }

    }

    async displayResults(issues) {
        this.resultsCount.textContent = `Found ${issues.length} issues`;
        
        if (issues.length === 0) {
        this.resultsList.innerHTML = 'No issues found with matching properties';
        return;
        }

        this.resultsList.innerHTML = '';
        const maxResultsToShow = 100; // Limit for performance

        if (issues.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'Nenhuma issue encontrada.';
            this.resultsList.appendChild(emptyMsg);
            return;
        }

        issues.forEach(issue => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.padding = '6px';
            item.style.borderBottom = '1px solid #eee';
            item.style.cursor = 'pointer';

            // Circulo colorido
            const circle = document.createElement('div');
            circle.style.width = '12px';
            circle.style.height = '12px';
            circle.style.borderRadius = '50%';
            circle.style.marginRight = '10px';
            circle.style.backgroundColor = STATUS_COLORS[issue.status] || '#999';

            // Texto do nome e status
            const text = document.createElement('div');
            text.innerHTML = `<strong>${issue.name}</strong><br><small>Status: ${issue.status}</small>`;

            item.appendChild(circle);
            item.appendChild(text);

            item.addEventListener('click', () => {
                console.log(`Issue clicada: ${issue.name}`);
                this.showIssuePopup(issue);
                // Aqui você pode adicionar interação no modelo se quiser
            });

            const color = STATUS_COLORS[issue.status] || 0x999999;
            // this.addMeshForIssue(issue, color, 0.5);  

            this.resultsList.appendChild(item);
        });

        this.activateIssueTracking(issues);

        // não sei se funciona isso ainda
        if (issues.length > maxResultsToShow) {
        const moreItem = document.createElement('div');
        moreItem.textContent = `...and ${issues.length - maxResultsToShow} more`;
        moreItem.style.padding = '4px';
        moreItem.style.color = '#666';
        moreItem.style.fontStyle = 'italic';
        this.resultsList.appendChild(moreItem);
        }
    }



    showIssuePopup(issue) {
        const popup = document.getElementById('issue-detail-popup');
        document.getElementById('popup-issue-name').textContent = issue.name;
        document.getElementById('popup-issue-description').textContent = issue.description;
        document.getElementById('popup-issue-status').textContent = issue.status;
        document.getElementById('popup-issue-severity').textContent = issue.severity;
        document.getElementById('popup-issue-location').textContent = issue.location;
        document.getElementById('popup-issue-assignee').textContent = issue.assignee;
        document.getElementById('popup-issue-due').textContent = new Date(issue.dueDate).toLocaleDateString();

        popup.style.display = 'block';

        document.getElementById('close-issue-popup').addEventListener('click', () => {
            document.getElementById('issue-detail-popup').style.display = 'none';
        });
    }



  // MESHES NO VIEWER

    addMeshesForIssues(issues) {
        const viewer = this.viewer;
        const camera = viewer.navigation.getCamera();
        const cameraPos = camera.position.clone();
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);

        // Vetores right e up relativos à câmera
        const cameraUp = camera.up.clone().normalize(); // vetor up (geralmente Z)
        const cameraRight = new THREE.Vector3().crossVectors(cameraDir, cameraUp).normalize(); // vetor right (horizontal)

        const overlayName = 'issues-overlay';
        if (!viewer.overlays.hasScene(overlayName)) {
            viewer.overlays.addScene(overlayName);
        } else {
            viewer.overlays.clearScene(overlayName);
        }

        const distance = 5;         // distância à frente
        const spread = 2;           // raio de espalhamento no plano
        const centerPos = cameraPos.clone().add(cameraDir.multiplyScalar(distance));
        
        issues.forEach((issue, index) => {
            const angle = (index / issues.length) * 2 * Math.PI; // distribui em círculo
            const offsetRight = cameraRight.clone().multiplyScalar(spread * Math.cos(angle));
            const offsetUp = cameraUp.clone().multiplyScalar(spread * Math.sin(angle));

            const meshPos = centerPos.clone().add(offsetRight).add(offsetUp);

            const geometry = new THREE.SphereGeometry(0.5, 16, 16);
            const color = this.getStatusColor(issue.status);
            const material = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.copy(meshPos);
            mesh.name = `issue-${issue.name}-${issue.id}`;
            mesh.userData = {
                isIssue: true,
                issue: issue
            }

            viewer.overlays.addMesh(mesh, overlayName);
            this.issue_meshes.push(mesh);
        });

        this.viewer.impl.invalidate(true); // Forçar atualização do viewer
    }

    activateIssueTracking(issues) {
        this.issues = issues;
        this.addMeshesForIssues(issues);

        const updatePositions = () => {
            if(!this.issue_meshes) return;

            const viewer = this.viewer;
            const camera = viewer.navigation.getCamera();
            const cameraPos = camera.position.clone();
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);

            const cameraUp = camera.up.clone().normalize();
            const cameraRight = new THREE.Vector3().crossVectors(cameraDir, cameraUp).normalize();

            const distance = 5;
            const spread = 2;
            const centerPos = cameraPos.clone().add(cameraDir.multiplyScalar(distance));

            this.issue_meshes.forEach((mesh, index) => {
                const angle = (index / this.issue_meshes.length) * 2 * Math.PI;
                const offsetRight = cameraRight.clone().multiplyScalar(spread * Math.cos(angle));
                const offsetUp = cameraUp.clone().multiplyScalar(spread * Math.sin(angle));
                const meshPos = centerPos.clone().add(offsetRight).add(offsetUp);

                mesh.position.copy(meshPos);
            });
        };

        this.onMeshClick = (event) => {
            const mesh = this.getIntersectedMesh(event);
            if (mesh && mesh.userData.isIssue) {
                const issue = mesh.userData.issue;
                if(issue){
                    this.showIssuePopup(issue);
                }
            }

        }

        // Salvar a função para poder remover depois
        this.cameraCallback = updatePositions;
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.cameraCallback);
        // this.viewer.canvas.addEventListener('click', this.onMeshClick);

        // this.boundOnPointerDown  = this.onPointerDown.bind(this);
        // // this.viewer.impl.canvas.addEventListener('click', this.onMeshClick);
        // this.viewer.container.addEventListener('pointerdown', this.boundOnPointerDown );
        

    }

    initDragInteraction() {
        this.selectedMeshForAction = null;

        
        // this.boundPointerMove = this.onPointerMove.bind(this);
        this.boundPointerDown = this.onPointerDown.bind(this);

        // this.viewer.impl.canvas.addEventListener('pointermove', this.boundPointerMove);
        this.viewer.impl.canvas.addEventListener('pointerdown', this.boundPointerDown);

        this.currentHoveredMesh = null;

    }

    onPointerDown(event) {
        const clickedMesh = this.getMeshNearCursor(event);

        if (clickedMesh) {
            if (clickedMesh.userData?.isIssue) {
                const issue = clickedMesh.userData.issue;
                this.showIssuePopup(issue);
            }
        }
    }

    getMeshNearCursor(event) {
        const clickX = event.clientX;
        const clickY = event.clientY;

        const canvasBounds = this.viewer.container.getBoundingClientRect();

        for (const mesh of this.issue_meshes) {
            const pos = mesh.position.clone();
            pos.project(this.viewer.impl.camera);

            const screenX = (pos.x + 1) / 2 * canvasBounds.width + canvasBounds.left;
            const screenY = (-pos.y + 1) / 2 * canvasBounds.height + canvasBounds.top;

            // Calcular um ponto próximo (ex.: deslocado no eixo X)
            const offsetPos = mesh.position.clone().add(new THREE.Vector3(mesh.geometry.boundingSphere.radius, 0, 0));
            offsetPos.project(this.viewer.impl.camera);

            const offsetScreenX = (offsetPos.x + 1) / 2 * canvasBounds.width + canvasBounds.left;
            const offsetScreenY = (-offsetPos.y + 1) / 2 * canvasBounds.height + canvasBounds.top;

            // Distância projetada em pixels → tamanho visual
            const detectionRadius = Math.hypot(offsetScreenX - screenX, offsetScreenY - screenY);

            // Tolerância extra mínima para não ficar muito pequeno
            const finalRadius = Math.max(detectionRadius, 10); // pelo menos 10px

            const distanceToClick = Math.hypot(screenX - clickX, screenY - clickY);

            if (distanceToClick <= finalRadius) {
                return mesh; // encontrou mesh clicado
            }
        }

        return null; // nenhum mesh próximo
    }

    // onPointerMove(event) {
    //     const hoveredMesh = this.getMeshNearCursor(event);
    //     console.log("hoveredMesh", hoveredMesh);

    //     if (this.currentHoveredMesh && this.currentHoveredMesh !== hoveredMesh) {
    //         if (this.currentHoveredMesh.material && this.currentHoveredMesh.material.emissive) {
    //             this.currentHoveredMesh.material.emissive.set(0x000000);
    //         }
    //         this.viewer.impl.invalidate(true);
    //         this.currentHoveredMesh = null;
    //     }

    //     if (hoveredMesh) {
    //         if (hoveredMesh.material && hoveredMesh.material.emissive) {
    //             hoveredMesh.material.emissive.set(0x555555);
    //         }
    //         this.viewer.impl.invalidate(true);
    //         this.currentHoveredMesh = hoveredMesh;
    //     }
    // }


    onPointerDownBkp(event) {
        const screenPoint = {
            x: event.clientX,
            y: event.clientY
        };
        const viewerRect = this.viewer.container.getBoundingClientRect();
        const hitTest = this.viewer.impl.hitTest(
            screenPoint.x - viewerRect.left,
            screenPoint.y - viewerRect.top,
            true
        );

        if (hitTest?.object && hitTest.object.userData?.isIssue) {
            const issue = hitTest.object.userData.issueData;
            this.showIssuePopup(issue);
            return;
        }

        // (mantenha suas outras verificações de pushpin aqui se precisar)
    }


    getIntersectedMesh(event) {
        const viewer = this.viewer;
        const canvasBounds = viewer.impl.canvas.getBoundingClientRect();

        const x = ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
        const y = -((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1;

        const pointer = new THREE.Vector2(x, y);
        const raycaster = new THREE.Raycaster();
        
        // USE a câmera do viewer diretamente, ela já é THREE.PerspectiveCamera
        raycaster.setFromCamera(pointer, viewer.impl.camera);

        const meshes = this.issueMeshes || [];

        const intersects = raycaster.intersectObjects(meshes, true);
        return intersects.length > 0 ? intersects[0].object : null;
    }




    getStatusColor(status) {
        return STATUS_COLORS[status] || 0x999999;
    }



}

Autodesk.Viewing.theExtensionManager.registerExtension('ShowIssuesExtension', ShowIssuesExtension);