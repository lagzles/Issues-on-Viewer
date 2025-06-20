export default class CreatePushpinExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this.viewer = viewer;

        this.subToolbar = null;
        this.pushpins = {};
        this.currentId = 0;
        this.addedEventoListener = false;

        this.pushpinContainer = null;
        this.selectedPushpin = null;
        this.idDragging = false;
    }

    load() {
        this.createPushpinContainer();
        this.viewer.addEventListener(Autodesk.Viewing.TEXTURES_LOADED_EVENT, this.createToolbar.bind(this));
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.updatePushpinsPosition.bind(this));
        return true;
    }

    unload() {
        if (this.subToolbar) {
            this.viewer.toolbar.removeControl(this.subToolbar);
        }

        if (this.pushpinContainer) {
            this.pushpinContainer.remove();
        }

        this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.updatePushpinsPosition.bind(this));
        return true;
    }

    createPushpinContainer() {
        this.pushpinContainer = document.createElement('div');
        this.pushpinContainer.id = 'pushpin-container';
        this.pushpinContainer.style.position = 'absolute';
        this.pushpinContainer.style.top = '0';
        this.pushpinContainer.style.left = '0';
        this.pushpinContainer.style.pointerEvents = 'none';
        this.pushpinContainer.style.zIndex = '100';

        this.viewer.container.appendChild(this.pushpinContainer);
    }

    createToolbar() {
        const buttonAdd = new Autodesk.Viewing.UI.Button('createPushPinButton');
        buttonAdd.setToolTip('Add Pushpin');
        buttonAdd.setIcon('adsk-icon-properties');
        buttonAdd.onClick = () => {
            this.enableAddMode();
        };

        const buttonRemove = new Autodesk.Viewing.UI.Button('removePushPinButton');
        buttonRemove.setToolTip('Remove Selected Pushpin');
        buttonRemove.setIcon('adsk-icon-delete');
        buttonRemove.onClick = () => {
            this.removeSelectedPushpin();
        };

        const buttonClear = new Autodesk.Viewing.UI.Button('clearPushPinsButton');
        buttonClear.setToolTip('Clear All Pushpins');
        buttonClear.setIcon('adsk-icon-delete');
        buttonClear.onClick = () => {
            this.clearAllPushpins();
        };

        const subToolbar = new Autodesk.Viewing.UI.ControlGroup('pushpinToolbar');
        subToolbar.addControl(buttonAdd);
        subToolbar.addControl(buttonRemove);
        subToolbar.addControl(buttonClear);

        this.viewer.toolbar.addControl(subToolbar);
        this.subToolbar = subToolbar;
    }

    enableAddMode() {
        const onClick = (event) => {
            const viewerRect = this.viewer.container.getBoundingClientRect();
            const screenPoint = {
                x: event.clientX - viewerRect.left,
                y: event.clientY - viewerRect.top,
            };

            const hitTest = this.viewer.impl.hitTest(screenPoint.x, screenPoint.y, true);

            if (hitTest) {
                const position = hitTest.intersectPoint;
                const viewpointId = Date.now();

                this.addPushpin(position, viewpointId);
               
            }

            this.viewer.container.removeEventListener('click', onClick);
            this.addedEventoListener = false;
        };

        if (!this.addedEventoListener) {
            this.viewer.container.addEventListener('click', onClick);
            this.addedEventoListener = true;
        }
    }

    addPushpin(position, id) {
        const div = document.createElement('div');
        div.className = 'pushpin';
        div.dataset.id = id;
        div.style.position = 'absolute';
        div.style.width = '12px';
        div.style.height = '12px';
        div.style.backgroundColor = '#ff0000';  
        div.style.border = '2px solid white';
        div.style.borderRadius = '50%';
        div.style.boxShadow = '0px 0px 6px rgba(0,0,0,0.6)';
        div.style.cursor = 'pointer';
        div.style.pointerEvents = 'auto';

        div.onclick = (e) => {
            e.stopPropagation();
            this.selectPushpin(id);
        };

        div.onpointerdown = (e) => {
            e.stopPropagation();
            this.startDrag(e, id);
        };

        this.pushpinContainer.appendChild(div);

        this.pushpins[id] = {
            id,
            position,
            element: div
        };

        this.updatePushpinsPosition();
    }

    selectPushpin(id) {
        if (this.selectedPushpin) {
            const prev = this.pushpins[this.selectedPushpin];
            if (prev) prev.element.style.backgroundColor = '#ff0000';
        }

        this.selectedPushpin = id;

        const current = this.pushpins[id];
        if (current) {
            current.element.style.backgroundColor = '#00aaff';
        }

        console.log('Pushpin selecionado:', id);
    }

    removeSelectedPushpin() {
        if (!this.selectedPushpin) {
            console.warn('Nenhum pushpin selecionado.');
            return;
        }

        const pushpin = this.pushpins[this.selectedPushpin];
        if (pushpin) {
            pushpin.element.remove();
            delete this.pushpins[this.selectedPushpin];
            console.log('Pushpin removido:', this.selectedPushpin);
        }

        this.selectedPushpin = null;
    }

    clearAllPushpins() {
        Object.values(this.pushpins).forEach(pin => {
            pin.element.remove();
        });

        this.pushpins = {};
        this.selectedPushpin = null;
        console.log('Todos os pushpins foram removidos');
    }

    updatePushpinsPosition() {
        const cameraPos = this.viewer.navigation.getCamera().position;

        Object.values(this.pushpins).forEach(pin => {
            const screenPoint = this.viewer.worldToClient(pin.position);

            // Cálculo da distância da câmera ao pushpin
            const distance = cameraPos.distanceTo(pin.position);

            // Ajuste de escala — quanto maior a distância, menor o pushpin
            const scale = Math.max(0.5, Math.min(2, 100 / distance)); // Limita o mínimo e máximo

            const size = 12 * scale;

            pin.element.style.width = `${size}px`;
            pin.element.style.height = `${size}px`;
            pin.element.style.left = `${screenPoint.x - size / 2}px`;
            pin.element.style.top = `${screenPoint.y - size / 2}px`;
        });
    }

    startDrag(e, id) {
        this.isDragging = true;
        const onMove = (moveEvent) => {
            const viewerRect = this.viewer.container.getBoundingClientRect();
            const screenPoint = {
                x: moveEvent.clientX - viewerRect.left,
                y: moveEvent.clientY - viewerRect.top,
            };

            const hitTest = this.viewer.impl.hitTest(screenPoint.x, screenPoint.y, true);

            if (hitTest) {
                const newPos = hitTest.intersectPoint;
                const pushpin = this.pushpins[id];
                if (pushpin) {
                    pushpin.position = newPos;
                    this.updatePushpinsPosition();
                }
            }
        };

        const onUp = () => {
            this.isDragging = false;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension('CreatePushpinExtension', CreatePushpinExtension);
