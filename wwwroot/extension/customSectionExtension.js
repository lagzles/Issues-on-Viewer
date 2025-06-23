// Initialize the extension
export default class CustomSectionExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.sectionActive = false;
        this.sectionPoint = null;
        this.range = 5; // Default range in meters

        this.pushpins = {};
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hovered = null;
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onClick = this.onClick.bind(this);
    }

    load() {
        // Create UI elements
        if (!this.viewer.overlays.hasScene('pushpin-overlay')) {
            this.viewer.overlays.addScene('pushpin-overlay');
        }

        this.viewer.canvas.addEventListener('mousemove', this.onMouseMove);
        this.viewer.canvas.addEventListener('click', this.onClick);

        this.createToolbarButton();
        return true;
    }

    unload() {
        this.viewer.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.viewer.canvas.removeEventListener('click', this.onClick);

        if (this.viewer.overlays.hasScene('pushpin-overlay')) {
            this.viewer.overlays.removeScene('pushpin-overlay');
        }


        this.removeUI();
        return true;
    }

    createToolbarButton(){
        const viewer = this.viewer;
        const _this = this;

        function createUI() {
        _this.button = new Autodesk.Viewing.UI.Button('customSectionButton');
        _this.button.setToolTip('Section Model');
        _this.button.setIcon('adsk-icon-plane-y');
        _this.button.onClick = () => {
            _this.showSearchPanel();
        };

        const subToolbar = new Autodesk.Viewing.UI.ControlGroup('customSectionToolbar');
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
        this.panel = new CustomSectionPanel(this, 'IssueManagerPanel', 'Mostrar Issues', this.viewer);
        this.panel.setVisible(true);
    }

    removeUI() {
        if (this.subToolbar) {
            this.viewer.toolbar.removeControl(this.subToolbar);
        }
        if (this.panel) {
            this.panel.setVisible(false);
        }
    }

    onMouseMove(event) {
        // const rect = this.viewer.canvas.getBoundingClientRect();

        // this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        // this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // this.raycaster.setFromCamera(this.mouse, this.viewer.impl.camera);

        // const meshes = Object.values(this.pushpins).map(p => p.mesh);

        // const intersects = this.raycaster.intersectObjects(meshes, false);

        // if (intersects.length > 0) {
        //     const object = intersects[0].object;

        //     if (this.hovered !== object) {
        //         if (this.hovered) {
        //             this.onHoverOut(this.hovered);
        //         }
        //         this.hovered = object;
        //         this.onHoverIn(object);
        //     }
        // } else {
        //     if (this.hovered) {
        //         this.onHoverOut(this.hovered);
        //         this.hovered = null;
        //     }
        // }
    }

    /** Efeito quando o mouse entra no mesh */
    onHoverIn(object) {
        object.currentHex = object.material.color.getHex();
        object.material.color.setHex(0x00ff00); // Verde ao hover
        this.viewer.impl.sceneUpdated(true);
    }

    /** Efeito quando o mouse sai do mesh */
    onHoverOut(object) {
        object.material.color.setHex(object.currentHex);
        this.viewer.impl.sceneUpdated(true);
    }

    /** Click no pushpin */
    onClick(event) {
        if (this.hovered) {
            const id = this.hovered.userData.id;
            console.log('Pushpin clicado:', id);
            alert(`Clicou no pushpin: ${id}`);
        }
    }
}



class CustomSectionPanel extends Autodesk.Viewing.UI.DockingPanel {
  constructor(extension, id, title, viewer, options = {}) {
    super(viewer.container, id, title);
    this.extension = extension;
    this.viewer = viewer;

    this.container.style.left = (options.x || 10) + 'px';
    this.container.style.top = (options.y || 10) + 'px';
    this.container.style.width = (options.width || 350) + 'px';

    this.container.style.flex = '1'
    this.container.style.resize = 'none';
    this.container.classList.add('docking-panel-container-solid-color');
    this.footer=null;
    this.range = 5;

    this.finishedSearching = false;

    this.issue_meshes = [];
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

        this.heightInput = document.createElement('input');
        this.heightInput.type = 'number';
        this.heightInput.placeholder = 'Height (m)';
        this.heightInput.style.width = '100%';
        this.heightInput.style.marginBottom = '10px';
        this.heightInput.style.padding = '6px';
        this.heightInput.style.border = '1px solid #ccc';
        this.heightInput.style.borderRadius = '4px';
        this.heightInput.style.boxSizing = 'border-box';
        this.heightInput.value = this.range;
        this.heightInput.onchange = () => {
            const newRange = parseFloat(this.heightInput.value);
            if (!isNaN(newRange) && newRange > 0) {
                this.range = newRange;
            }

            if(this.sectionPoint) {
                this.applySection(this.sectionPoint);
            }
        };
        this.body.appendChild(this.heightInput);

       
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


        const clearButton = document.createElement('button');
        clearButton.textContent = 'Limpar';
        clearButton.style.padding = '6px 12px';
        clearButton.style.border = '1px solid #ccc';
        clearButton.style.borderRadius = '4px';
        clearButton.style.backgroundColor = '#f0f0f0';
        clearButton.onclick = () => {
            this.clearSection();
        };
        footer.appendChild(clearButton);


        const selectButton = document.createElement('button');
        selectButton.textContent = 'Select';
        selectButton.style.padding = '6px 12px';
        selectButton.style.border = '1px solid #ccc';
        selectButton.style.borderRadius = '4px';
        selectButton.style.backgroundColor = '#f0f0f0';
        selectButton.onclick = () => {
            this.selectModelPoint();
        };
        footer.appendChild(selectButton);

        this.container.appendChild(footer);
    }

    destroy() {

        if (typeof this.uninitialize === 'function') {
            this.uninitialize();
        }
        this.container = null;
        this.content = null;
        this.title = null;
    }


    closePanel() {
        console.log("closePanel")
        this.destroy();
        if (this.extension) this.extension.panel = null;
    }

    selectModelPoint() {
        this.sectionActive = !this.sectionActive;
        
        if (this.sectionActive) {
            // Set up selection handler
            this.selectionHandler = (ev) => {const viewerRect = this.viewer.container.getBoundingClientRect();
            const screenPoint = {
                x: ev.clientX - viewerRect.left,
                y: ev.clientY - viewerRect.top,
            };

            const hitTest = this.viewer.impl.hitTest(screenPoint.x, screenPoint.y, true);

                if (hitTest && hitTest.point) {
                    this.sectionPoint = hitTest.point;
                    this.applySection(this.sectionPoint);

                    this.viewer.container.removeEventListener('click', this.selectionHandler);
                    this.sectionActive = false;

                }
            };
            
            this.viewer.container.addEventListener('click', this.selectionHandler);
        } else {
            this.button.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
            this.viewer.container.removeEventListener('click', this.selectionHandler);
            this.clearSection();

        }
    }

    applySection(point) {
        // pegar model bounding box
        const bboxModel = this.viewer.model.getBoundingBox();
        const bbMinPt = bboxModel.min;
        const bbMxPt = bboxModel.max;

        const minPt = new THREE.Vector3( bbMinPt.x, bbMinPt.y, point.z - this.range / 2.0 ); //!<<< put your point here
        const maxPt = new THREE.Vector3( bbMxPt.x, bbMxPt.y, point.z + this.range / 2.0 ); //!<<< put your point here

        
        const normals = [
            new THREE.Vector3(1, 0, 0), 
            new THREE.Vector3(0, 1, 0), 
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, -1)
        ];

        const bbox = new THREE.Box3( minPt, maxPt );
        const cutPlanes = [];

        for( let i = 0; i < normals.length; i++ ) {
            const plane = new THREE.Plane( normals[i], -1 * maxPt.dot( normals[i] ) );

            // offset plane with negative normal to form an octant
            if( i > 2 ) {
                const ptMax = plane.orthoPoint( bbox.max );
                const ptMin = plane.orthoPoint( bbox.min );
                const size = new THREE.Vector3().subVectors( ptMax, ptMin );
                plane.constant -= size.length();
            }

            const n = new THREE.Vector4( plane.normal.x, plane.normal.y, plane.normal.z, plane.constant );
            cutPlanes.push( n );
        }

        this.viewer.setCutPlanes( cutPlanes );

        // this.createArrowMesh({ 
        //     x: (minPt.x + maxPt.x) / 2,
        //     y: (minPt.y + maxPt.y) / 2,
        //     z: point.z - this.range * 2
        //  }, 'up-arrow', 0x00ff00);

        //  this.createArrowMesh({ 
        //     x: (minPt.x + maxPt.x) / 2,
        //     y: (minPt.y + maxPt.y) / 2,
        //     z: point.z + this.range * 2
        //  }, 'down-arrow', 0xff0000);


    }

    createArrowMesh(position, pushpinId, color = 0x00ff00) {

        if (!this.viewer.overlays.hasScene('pushpin-overlay')) {
            this.viewer.overlays.addScene('pushpin-overlay');
        }

        const tamanho = 5
        const torsoHeight = tamanho;
        const limbRadius = tamanho * 0.15;

        const material = new THREE.MeshPhongMaterial({
          specular: new THREE.Color(color),
          side: THREE.DoubleSide,
          reflectivity: 0.0,
          color
        })
    
        const materials = this.viewer.impl.getMaterials()
    
        materials.addMaterial(
          color.toString(16),
          material,
          true)


        const torsoGeometry = new THREE.CylinderBufferGeometry(limbRadius, limbRadius, torsoHeight, 32);
        const torso = new THREE.Mesh(torsoGeometry, material);
        torso.position.set(position.x, position.y, position.z + torsoHeight / 2 );
        torso.rotation.x = Math.PI / 2;
        torso.name = pushpinId;
        torso.userData = { isPushpin: true };

        this.viewer.impl.scene.add(torso);
        this.viewer.impl.sceneUpdated(true);

        this.extension.pushpins[pushpinId] = {
            id: pushpinId,
            position: position,
            element: torso,
        };

    }

    restoreSectionBox(viewer, cutplanes) {
        let box = new THREE.Box3();
        for (const cutplane of cutplanes) {
            const normal = new THREE.Vector3(cutplane[0], cutplane[1], cutplane[2]);
            const offset = cutplane[3];
            const pointOnPlane = normal.negate().multiplyScalar(offset);
            box.expandByPoint(pointOnPlane);
        }
        const sectionExt = viewer.getExtension('Autodesk.Section');
        sectionExt.setSectionBox(box);
    }

    clearSection() {
        this.viewer.setCutPlanes([]);
        this.sectionPoint = null;
    }




}

// Register the extension
Autodesk.Viewing.theExtensionManager.registerExtension('CustomSectionExtension', CustomSectionExtension);