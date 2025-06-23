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
        this.createUI();
        return true;
    }

    unload() {
        this.removeUI();
        return true;
    }

    createUI() {
        // Create a toolbar button
        this.button = new Autodesk.Viewing.UI.Button('custom-section-button');
        this.button.onClick = (ev) => {
            this.toggleSectionTool();
        };
        this.button.setToolTip('Custom Section Tool');
        this.button.addClass('custom-section-icon');
        
        // Add range control
        this.rangeInput = document.createElement('input');
        this.rangeInput.type = 'number';
        this.rangeInput.value = this.range;
        this.rangeInput.min = 0.1;
        this.rangeInput.step = 0.1;
        this.rangeInput.style.width = '60px';
        this.rangeInput.style.margin = '0 5px';
        this.rangeInput.addEventListener('change', (ev) => {
            this.range = parseFloat(ev.target.value);
            if (this.sectionActive && this.sectionPoint) {
                this.applySection(this.sectionPoint);
            }
        });
        
        // Create panel
        this.panel = new Autodesk.Viewing.UI.PropertyPanel(this.viewer.container);
        this.panel.addProperty('Section Range (m)', this.rangeInput, 'section-range');
        
        // Add to toolbar
        this.subToolbar = new Autodesk.Viewing.UI.ControlGroup('custom-section-toolbar');
        this.subToolbar.addControl(this.button);
        this.viewer.toolbar.addControl(this.subToolbar);
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

// Register the extension
Autodesk.Viewing.theExtensionManager.registerExtension('CustomSectionExtension', CustomSectionExtension);