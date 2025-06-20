export default class CreatePushpinExtension extends Autodesk.Viewing.Extension {
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
    if (this.subToolbar) {
            this.viewer.toolbar.removeControl(this.subToolbar);
        }

        if (this.torsoMesh) {
            this.viewer.impl.scene.remove(this.torsoMesh);
        }
        if (this.headMesh) {
            this.viewer.impl.scene.remove(this.headMesh);
        }

        this.viewer.impl.sceneUpdated(true);
        return true;
  }

  createToolbarButton() {
    const viewer = this.viewer;
    const _this = this;

    function createUI() {
      _this.button = new Autodesk.Viewing.UI.Button('createPushPinButton');
      _this.button.setToolTip('Create Pushpin');
      _this.button.setIcon('adsk-icon-properties');
      _this.button.onClick = () => {
        _this.createPushpin();
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

  createPushpin() {
    this.viewer.container.adEventListener('click', this.onModelClick.bind(this));
  }

  onModelClick(event) {
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

        const captureViewpointId = 101;;
    
        if (hitTest) {
            const intersectPoint = hitTest.intersectPoint;
    
            this.drawPushpin(intersectPoint, captureViewpointId);
            this.pushpinsNotSavedIds.push(captureViewpointId);

            this.viewer.fireEvent({
                type:'capture-completed',
                detail: {
                    viewpointId: captureViewpointId,
                    coordinates: intersectPoint,
                    id: null
                }
            })
    
            this.captureMode = false;
            captureViewpointId = null;

            this.viewer.container.removeEventListener('click', this.onModelClick.bind(this));
        }
    }

    drawPushpin(position, viewpointId, color = 'blue') {
        // Converte a posição 3D para coordenadas 2D da tela
        this.pushpinsIds.push(viewpointId);
        // // Cria a div e o svg para o pushpin
        const pushpinId = 'pushpin-' + viewpointId;
        try {

            this.createPerson(position, pushpinId);

        } catch (errorr) {
            console.log("ERRO SESU IDIOTA", errorr)
        }
    }

    createPerson(position, pushpinId, color = 'blue', totalHeight = 6) {
    
        const headHeight = totalHeight * 0.15;
        const torsoHeight = totalHeight * 0.85;
        const limbRadius = totalHeight * 0.035;
        const headRadius = headHeight / 2;
    
        const material = this.createColorMaterial(color);
    
        // Cabeça
        const headGeometry = new THREE.SphereBufferGeometry(headRadius, 32, 32);
        const head = new THREE.Mesh(headGeometry, material);
        head.position.set(position.x, position.y, position.z + torsoHeight + headRadius + legLength);
        head.name = pushpinId;
        head.userData = { isPushpin: true };
    
        // Tronco
        const torsoGeometry = new THREE.CylinderBufferGeometry(limbRadius, limbRadius, torsoHeight, 32);
        const torso = new THREE.Mesh(torsoGeometry, material);
        torso.position.set(position.x, position.y, position.z + torsoHeight / 2 + legLength);
        torso.rotation.x = Math.PI / 2;
        torso.name = pushpinId;
        torso.userData = { isPushpin: true };

        this.safeAddMesh(head);
        this.safeAddMesh(torso);
    
        this.viewer.impl.sceneUpdated(true);
    
        const personParts = [ head, torso];
        this.pushpinsMeshes.push({ pushpinId: pushpinId, meshes: personParts });
      }
    
}