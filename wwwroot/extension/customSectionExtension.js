// Initialize the extension
export default class CustomSectionExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.sectionActive = false;
        this.sectionPoint = null;
        this.range = 5; // Default range in meters
    }

    load() {
        // Create UI elements
        this.createToolbarButton();
        return true;
    }

    unload() {
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

    toggleSectionTool() {
        this.sectionActive = !this.sectionActive;
        
        if (this.sectionActive) {
            this.button.setState(Autodesk.Viewing.UI.Button.State.ACTIVE);
            this.panel.setVisible(true);
            this.viewer.setSelectionMode(Autodesk.Viewing.SelectionMode.MODEL);
            
            // Set up selection handler
            this.selectionHandler = (ev) => {
                const hitTest = this.viewer.clientToWorld(ev.clientX, ev.clientY, true);
                if (hitTest && hitTest.point) {
                    this.sectionPoint = hitTest.point;
                    this.applySection(this.sectionPoint);
                }
            };
            
            this.viewer.container.addEventListener('click', this.selectionHandler);
        } else {
            this.button.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
            this.panel.setVisible(false);
            this.viewer.container.removeEventListener('click', this.selectionHandler);
            this.clearSection();
        }
    }

    applySection(point) {
        // Create a plane for sectioning
        const plane = new THREE.Plane();
        
        // Create top and bottom planes
        const topPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), -point.z - this.range);
        const bottomPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), point.z - this.range);
        
        // Apply sectioning
        this.viewer.setCutPlanes([topPlane, bottomPlane]);
    }

    clearSection() {
        this.viewer.setCutPlanes([]);
        this.sectionPoint = null;
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
    // this.container.style.height = (options.height || 250) + 'px';
    this.container.style.flex = '1'
    this.container.style.resize = 'none';
    this.container.classList.add('docking-panel-container-solid-color');
    this.footer=null;

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


        const clearButton = document.createElement('button');
        clearButton.textContent = 'Select';
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
        const mbbMxPt = bboxModel.max;

        const minPt = new THREE.Vector3( bbMinPt.x, bbMinPt.y, point.z - 3 ); //!<<< put your point here
        const maxPt = new THREE.Vector3( mbbMxPt.x, mbbMxPt.y, point.z + 3 ); //!<<< put your point here


        let box = new THREE.Box3(minPt, maxPt);
        let sectionExt = this.viewer.getExtension('Autodesk.Section');
        sectionExt.setSectionBox(box);

        return ;


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

    }

    clearSection() {
        this.viewer.setCutPlanes([]);
        this.sectionPoint = null;
    }




}

// Register the extension
Autodesk.Viewing.theExtensionManager.registerExtension('CustomSectionExtension', CustomSectionExtension);