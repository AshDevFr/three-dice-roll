"use strict";
import * as CANNON from "cannon";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";

export class Board {
  constructor(options) {
    options = this.setDefaults(options, {
      debug: false,
      debugPlane: false,
      debugWalls: false,
      container: document.body,
      dimensions: null,
      stableThreshold: 10,
      gravityFactor: 100,
    });

    this.debug = options.debug;
    this.debugPlane = options.debugPlane;
    this.debugWalls = options.debugWalls;
    this.container = options.container;
    this.dimensions = options.dimensions;
    this.stableThreshold = options.stableThreshold;
    this.gravityFactor = options.gravityFactor;

    this.dice = [];
    this.lights = [];

    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82 * this.gravityFactor, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 16;
    this.world.allowSleep = true;

    this.diceBodyMaterial = new CANNON.Material();
    this.floorBodyMaterial = new CANNON.Material();
    this.barrierBodyMaterial = new CANNON.Material();

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(
        this.floorBodyMaterial,
        this.diceBodyMaterial,
        {
          friction: 1 / this.gravityFactor,
          restitution: 0.5,
        }
      )
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(
        this.barrierBodyMaterial,
        this.diceBodyMaterial,
        { friction: 0, restitution: 1.0 }
      )
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.diceBodyMaterial, this.diceBodyMaterial, {
        friction: 0,
        restitution: 0.5,
      })
    );

    this.scene = new THREE.Scene();
    this.scene.background = this.debug ? this.scene.background : null;

    this.width = Math.floor(this.container.clientWidth / 10);
    this.height =
      this.width * (this.container.clientHeight / this.container.clientWidth);

    this.initCamera();
    this.initLights();
    this.createPlane();

    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.initHelpers();
  }

  setDefaults(options, defaults) {
    options = options || {};

    for (let key in defaults) {
      if (!defaults.hasOwnProperty(key)) continue;

      if (!(key in options)) {
        options[key] = defaults[key];
      }
    }

    return options;
  }

  initHelpers() {
    if (this.debug) {
      console.warn("Debugger enabled");
      this.axesHelper = new THREE.AxesHelper(5);
      this.scene.add(this.axesHelper);

      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.screenSpacePanning = true;
      this.stats = Stats();
      this.container.appendChild(this.stats.dom);
    }
  }

  initCamera() {
    this.camera = new THREE.OrthographicCamera(
      this.width / -2,
      this.width / 2,
      this.height / 2,
      this.height / -2,
      1,
      this.width * 1.5
    );

    this.scene.add(this.camera);
    this.camera.position.set(0, this.width, 0);
    this.camera.lookAt(0, 0, 0);
  }

  initLights() {
    const ambient = new THREE.AmbientLight("#ffffff", 0.3);
    this.lights.push(ambient);
    this.scene.add(ambient);

    const directionalLight = new THREE.DirectionalLight("#ffffff", 0.5);
    directionalLight.position.x = -1000;
    directionalLight.position.y = 1000;
    directionalLight.position.z = 1000;
    this.lights.push(directionalLight);
    this.scene.add(directionalLight);

    const spotLight = new THREE.SpotLight(0xefdfd5, 1.3);
    spotLight.position.y = Math.max(this.width, this.height);
    spotLight.target.position.set(0, 0, 0);
    spotLight.castShadow = true;
    spotLight.shadow.camera.near = 50;
    spotLight.shadow.camera.far = 110;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    this.lights.push(spotLight);
    this.scene.add(spotLight);
  }

  createPlane() {
    // Plane
    const planeGeometry = new THREE.PlaneGeometry(
      this.width,
      this.height,
      10,
      10
    );
    const planeMesh = new THREE.Mesh(
      planeGeometry,
      new THREE.MeshPhongMaterial({
        opacity: this.debug && this.debugPlane ? 1 : 0,
        transparent: !this.debug || !this.debugPlane,
      })
    );
    planeMesh.rotateX(-Math.PI / 2);
    planeMesh.receiveShadow = true;
    this.scene.add(planeMesh);

    const planeShape = new CANNON.Plane();
    const planeBody = new CANNON.Body({
      mass: 0,
      material: this.floorBodyMaterial,
    });
    planeBody.addShape(planeShape);
    planeBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(1, 0, 0),
      -Math.PI / 2
    );
    this.world.addBody(planeBody);
    this.plane = {
      object: planeMesh,
      body: planeBody,
    };

    // Walls
    this.walls = {};

    // Left wall
    const leftWall = this.createWall("#41aa00", this.height);
    leftWall.object.rotation.y = -Math.PI / 2;
    leftWall.object.position.x = this.width / -2;
    leftWall.body.position.set(
      leftWall.object.position.x,
      leftWall.object.position.y,
      leftWall.object.position.z
    );
    leftWall.body.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, 1, 0),
      Math.PI / 2
    );
    this.walls.left = leftWall;

    // Right wall
    const rightWall = this.createWall("#0000aa", this.height);
    rightWall.object.rotation.y = Math.PI / 2;
    rightWall.object.position.x = this.width / 2;
    rightWall.body.position.set(
      rightWall.object.position.x,
      rightWall.object.position.y,
      rightWall.object.position.z
    );
    rightWall.body.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, 1, 0),
      -Math.PI / 2
    );
    this.walls.right = rightWall;

    // Top wall
    const topWall = this.createWall("#aa4400", this.width);
    topWall.object.rotation.z = -Math.PI;
    topWall.object.position.z = this.height / -2;
    topWall.body.position.set(
      topWall.object.position.x,
      topWall.object.position.y,
      topWall.object.position.z
    );
    // topWall.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
    this.walls.top = topWall;

    // Bottom wall
    const bottomWall = this.createWall("#aa00aa", this.width);
    bottomWall.object.rotation.z = Math.PI;
    bottomWall.object.position.z = this.height / 2;
    bottomWall.body.position.set(
      bottomWall.object.position.x,
      bottomWall.object.position.y,
      bottomWall.object.position.z
    );
    bottomWall.body.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, 1, 0),
      -Math.PI
    );
    this.walls.bottom = bottomWall;
  }

  createWall(color, length) {
    const wallMaterial = new THREE.MeshPhongMaterial({
      color: this.debug && this.debugWalls ? color : null,
      opacity: this.debug && this.debugWalls ? 1 : 0,
      transparent: !this.debug || !this.debugWalls,
      side: THREE.DoubleSide,
    });
    const wallGeometry = new THREE.PlaneGeometry(
      length,
      this.width / 2,
      10,
      10
    );
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    this.scene.add(wall);

    const wallBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.barrierBodyMaterial,
    });
    wallBody.position.set(wall.position.x, wall.position.y, wall.position.z);
    this.world.addBody(wallBody);

    return {
      object: wall,
      body: wallBody,
    };
  }

  isFinished() {
    return this.dice.reduce(
      (result, die) => (die.isFinished() ? result : false),
      true
    );
  }

  throwDice(callback) {
    this.isThrowing = true;

    this.dice.forEach((die, index) => {
      die.resetAnimation();
      die.object.position.x = this.width / -2 + (index % 3) * 1.5 * die.size;
      die.object.position.z = this.height / -2 + (index % 3) * 1.5 * die.size;
      die.object.position.y = die.size + (index % 3) * 1.5;
      die.updateBodyFromMesh();

      const xRand = 2 * this.gravityFactor + Math.random() * this.gravityFactor;
      const yRand = Math.random() * this.gravityFactor;
      const zRand = 2 * this.gravityFactor + Math.random() * this.gravityFactor;

      const gravityRatio = this.gravityFactor / 10;
      die.body.velocity.set(xRand, yRand, zRand);
      die.body.angularVelocity.set(
        2 * gravityRatio * Math.random() - gravityRatio,
        2 * gravityRatio * Math.random() - gravityRatio,
        2 * gravityRatio * Math.random() - gravityRatio
      );
    });

    let stableCount = 0;
    let limitThreshold = 100;
    let limitCount = 0;
    this.world.removeEventListener("postStep", this.check);
    this.check = () => {
      if (this.isFinished()) {
        stableCount++;

        if (
          stableCount === this.stableThreshold ||
          limitCount >= limitThreshold
        ) {
          this.isThrowing = false;
          this.world.removeEventListener("postStep", this.check);
          callback && callback(this.getUpsideValues());
        }
      } else {
        limitCount++;
        stableCount = 0;
      }
    };

    this.world.addEventListener("postStep", this.check);
  }

  showDice() {
    const length = this.dice.reduce((sum, die) => sum + die.getRadius() * 2, 0);
    let position = -length / 2;
    this.dice.forEach((die, index) => {
      die.resetAnimation();
      die.object.position.x = 0;
      die.object.position.z =
        position + die.getRadius() * 0.5 + die.getRadius() / 2;
      die.object.position.y = die.size;
      die.object.rotation.x = -Math.PI / 2;
      die.updateBodyFromMesh();

      position += die.getRadius() * 2;
    });
  }

  clear() {
    this.dice.forEach((die) => {
      this.scene.remove(die.object);
      this.world.removeBody(die.body);
    });
    this.dice = [];
  }

  getUpsideValues() {
    return this.dice.map((die) => this.getUpsideValue(die));
  }

  getUpsideValue(die) {
    const vector = new THREE.Vector3(0, 0, die.invertUpside ? -1 : 1);
    vector.applyQuaternion(this.plane.object.quaternion);
    let closest_face;
    let closest_angle = Math.PI * 2;

    const vectors = [];
    const normals = die.geometry.getAttribute("normal").array;
    for (let i = 0; i < normals.length; i += 3) {
      vectors.push(
        new THREE.Vector3(normals[i], normals[i + 1], normals[i + 2])
      );
    }

    const vectorRatio = vectors.length / die.faces.length;
    vectors.forEach((faceVector, index) => {
      let angle = faceVector
        .clone()
        .applyQuaternion(die.body.quaternion)
        .angleTo(vector);
      if (angle < closest_angle) {
        closest_angle = angle;
        closest_face = Math.floor(index / vectorRatio);
      }
    });

    return die.getFace(closest_face).value;
  }

  resize() {
    this.width = Math.floor(this.container.clientWidth / 10);
    this.height =
      this.width * (this.container.clientHeight / this.container.clientWidth);

    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.render();
  }

  renderDiceAnimations() {
    this.dice.forEach((die) => {
      die.animate();
    });
  }

  render() {
    this.renderDiceAnimations();
    this.renderer.render(this.scene, this.camera);
  }
}
