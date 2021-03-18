"use strict";
import * as CANNON from "cannon";
import * as THREE from "three";
import { uniqBy } from "lodash";
import { ConvexHull } from "three/examples/jsm/math/ConvexHull";
import { calc2Dpoint, colorToRGB, gradientColorStep } from "./utils";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils";

class DiceObject {
  /**
   * @constructor
   * @param {object} options
   * @param {Number} [options.size = 100]
   * @param {Number} [options.fontColor = '#000000']
   * @param {Number} [options.backColor = '#ffffff']
   */
  constructor(options) {
    options = this.setDefaults(options, {
      size: 8,
      fontColor: "#fff",
      backColor: "#000",
      highlightColor: "#f00",
    });

    this.geometry = null;
    this.object = null;
    this.body = null;

    this.verticesPerFace = 3;
    this.sidesPerFace = 3;
    this.angle = THREE.MathUtils.degToRad(120);

    this.size = options.size;
    this.scaleFactor = 1;
    this.invertUpside = false;

    this.materialOptions = {
      specular: 0x172022,
      color: 0xf0f0f0,
      shininess: 20,
      flatShading: THREE.FlatShading,
    };
    this.labelColor = colorToRGB(options.fontColor);
    this.diceColor = colorToRGB(options.backColor);
    this.highlightColor = colorToRGB(options.highlightColor);
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

  getBaseUvs() {
    const base = new THREE.Vector2(0, 0.5);
    const center = new THREE.Vector2();
    return [
      ...new Array(this.sidesPerFace - 1).fill(null).map((_, index) => {
        return base
          .clone()
          .rotateAround(center, this.angle * (index + 1))
          .addScalar(0.5);
      }),
      base.clone().rotateAround(center, 0).addScalar(0.5),
    ];
  }

  setUvs() {
    const uvs = [];
    const sides = [];

    const baseUVs = this.getBaseUvs();

    const uvRatio = this.verticesPerFace / 3;
    new Array(this.faces.length).fill(null).forEach((_, index) => {
      this.geometry.addGroup(
        index * this.verticesPerFace,
        this.verticesPerFace,
        index
      );

      for (let i = 0; i < uvRatio; i++) {
        uvs.push(
          baseUVs[i + 1].x,
          baseUVs[i + 1].y,
          baseUVs[i + 2].x,
          baseUVs[i + 2].y,
          baseUVs[0].x,
          baseUVs[0].y
        );
      }

      sides.push(...new Array(this.verticesPerFace).fill(index));
    });

    const uvNumComponents = 2;
    this.geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(uvs), uvNumComponents)
    );
    this.geometry.setAttribute(
      "sides",
      new THREE.Float32BufferAttribute(sides, 1)
    );
  }

  getPolyhedronShape() {
    const position = this.object.geometry.attributes.position.array;

    const pointsArray = [];
    for (let i = 0; i < position.length; i += 3) {
      pointsArray.push([position[i], position[i + 1], position[i + 2]]);
    }
    const uniqVertices = uniqBy(pointsArray, (p) => `${p[0]}_${p[1]}_${p[2]}`);
    const points = uniqVertices.map((point) => new THREE.Vector3(...point));
    const cannonPoints = uniqVertices.map((point) => new CANNON.Vec3(...point));
    const convexHull = new ConvexHull().setFromPoints(points);

    const faces = convexHull.faces.map((face) => {
      const p1 = face.edge.prev.vertex.point;
      const v1 = points.findIndex(
        (p) => p.x === p1.x && p.y === p1.y && p.z === p1.z
      );
      const p2 = face.edge.vertex.point;
      const v2 = points.findIndex(
        (p) => p.x === p2.x && p.y === p2.y && p.z === p2.z
      );
      const p3 = face.edge.next.vertex.point;
      const v3 = points.findIndex(
        (p) => p.x === p3.x && p.y === p3.y && p.z === p3.z
      );
      return [v1, v2, v3];
    });

    return new CANNON.ConvexPolyhedron(cannonPoints, faces);
  }

  updateBodyFromMesh() {
    this.body.position.copy(this.object.position);
    this.body.quaternion.copy(this.object.quaternion);
  }

  calculateTextureSize(approx) {
    return Math.max(
      128,
      Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)))
    );
  }

  createTextCanvas(face, defaultColor, color, backColor) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const ts =
      this.calculateTextureSize(this.size / 2 + this.size * this.textMargin) *
      2;
    canvas.width = canvas.height = ts;

    // Background
    context.fillStyle = backColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Text
    context.font = ts / (1 + 2 * this.textMargin) + "pt Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    if (face.angle) {
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(face.angle);
      context.fillText(face.text, 0, 0);
      context.restore();
    } else {
      context.fillText(face.text, canvas.width / 2, canvas.height / 2);
    }

    return canvas;
  }

  createTextTexture(face, defaultColor, color, backColor) {
    let canvas;
    if (this.customTextCanvasFunction) {
      canvas = this.customTextCanvasFunction(
        face,
        defaultColor,
        color,
        backColor
      );
    } else {
      canvas = this.createTextCanvas(face, defaultColor, color, backColor);
    }

    return new THREE.CanvasTexture(canvas);
  }

  computeMaterials() {
    this.faces.forEach((face) => {
      const texture = this.createTextTexture(
        face,
        this.labelColor,
        this.labelColor,
        this.diceColor
      );

      face.material = new THREE.MeshPhongMaterial(
        Object.assign({}, this.materialOptions, { map: texture })
      );
    });
  }

  getMaterials() {
    return this.faces.map((face) => face.material);
  }

  setAnimation(index) {
    this.animationOptions = {
      index,
      delta: 3,
      step: 10,
      currentValue: 0,
      value: 0,
      direction: "up",
    };
  }

  resetAnimation() {
    if (this.animationOptions) {
      this.animationOptions = null;
      this.object.material = this.getMaterials();
      this.object.material.needsUpdate = true;
    }
  }

  getFace(index) {
    this.setAnimation(index);
    return this.faces[index];
  }

  animate() {
    if (this.animationOptions) {
      if (this.animationOptions.direction === "up") {
        this.animationOptions.value += this.animationOptions.delta;
      } else {
        this.animationOptions.value -= this.animationOptions.delta;
      }

      this.applyAnimation();

      if (this.animationOptions.currentValue <= 0) {
        this.animationOptions.direction = "up";
      } else if (this.animationOptions.currentValue >= 100) {
        this.animationOptions.direction = "down";
      }
    }
  }

  applyAnimation() {
    if (
      Math.abs(
        this.animationOptions.value - this.animationOptions.currentValue
      ) >= this.animationOptions.step
    ) {
      this.animationOptions.currentValue = Math.floor(
        this.animationOptions.value
      );
      const face = this.faces[this.animationOptions.index];

      const newColor = gradientColorStep(
        this.highlightColor,
        this.labelColor,
        this.animationOptions.currentValue / 100
      );

      let canvas;
      if (this.customTextCanvasFunction) {
        canvas = this.customTextCanvasFunction(
          face,
          this.labelColor,
          newColor,
          this.diceColor
        );
      } else {
        canvas = this.createTextCanvas(
          face,
          this.labelColor,
          newColor,
          this.diceColor
        );
      }

      const texture = new THREE.CanvasTexture(canvas);

      this.object.material[
        this.animationOptions.index
      ] = new THREE.MeshPhongMaterial(
        Object.assign({}, this.materialOptions, { map: texture })
      );
      this.object.material.needsUpdate = true;
    }
  }

  getRadius() {
    return this.size * this.scaleFactor;
  }

  isFinished() {
    const threshold = 1;

    const angularVelocity = this.body.angularVelocity;
    const velocity = this.body.velocity;

    return (
      Math.abs(angularVelocity.x) < threshold &&
      Math.abs(angularVelocity.y) < threshold &&
      Math.abs(angularVelocity.z) < threshold &&
      Math.abs(velocity.x) < threshold &&
      Math.abs(velocity.y) < threshold &&
      Math.abs(velocity.z) < threshold
    );
  }

  getFaces() {
    throw "This method needs to be defined";
  }

  createGeometry() {
    throw "This method needs to be defined";
  }

  create(board) {
    this.createGeometry();
    this.geometry.computeFaceNormals();
    this.setUvs();

    this.computeMaterials();
    this.object = new THREE.Mesh(this.geometry, this.getMaterials());
    board.scene.add(this.object);

    this.object.reveiceShadow = true;
    this.object.castShadow = true;

    this.body = new CANNON.Body({
      mass: (board.gravityFactor * this.mass) / 1000,
      material: board.diceBodyMaterial,
    });
    this.body.linearDamping = 0.1;
    this.body.angularDamping = 0.1;
    this.body.addShape(this.getPolyhedronShape());

    board.dice.push(this);
    board.world.addBody(this.body);

    return this.object;
  }
}

export class DiceD4 extends DiceObject {
  constructor(options, board) {
    super(options);

    this.faces = this.getFaces();
    this.textMargin = 1.2;
    this.mass = 150;
    this.scaleFactor = 1;
    this.invertUpside = true;

    board && this.create(board);
  }

  getFaces() {
    return [
      { value: 1, label: "1", text: ["4", "2", "3"] },
      { value: 2, label: "2", text: ["3", "1", "4"] },
      { value: 3, label: "3", text: ["4", "1", "2"] },
      { value: 4, label: "4", text: ["2", "1", "3"] },
    ];
  }

  createGeometry() {
    this.geometry = new THREE.TetrahedronGeometry(this.getRadius(), 0);
  }

  customTextCanvasFunction(face, defaultColor, color, backColor) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const ts = this.calculateTextureSize(this.size / 2 + this.size * 2) * 2;
    canvas.width = canvas.height = ts;
    context.font = ts / 5 + "pt Arial";
    context.fillStyle = backColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (let i in face.text) {
      if (
        this.animationOptions &&
        this.faces[this.animationOptions.index].label === face.text[i]
      ) {
        context.fillStyle = color;
      } else {
        context.fillStyle = defaultColor;
      }
      context.fillText(
        face.text[i],
        canvas.width / 2,
        canvas.height / 2 - ts * 0.3
      );
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((Math.PI * 2) / 3);
      context.translate(-canvas.width / 2, -canvas.height / 2);
    }
    return canvas;
  }

  applyAnimation() {
    if (
      Math.abs(
        this.animationOptions.value - this.animationOptions.currentValue
      ) >= this.animationOptions.step
    ) {
      this.animationOptions.currentValue = Math.floor(
        this.animationOptions.value
      );
      const newColor = gradientColorStep(
        this.highlightColor,
        this.labelColor,
        this.animationOptions.currentValue / 100
      );

      this.faces.forEach((face, i) => {
        if (i !== this.animationOptions.index) {
          const canvas = this.customTextCanvasFunction(
            face,
            this.labelColor,
            newColor,
            this.diceColor
          );

          const texture = new THREE.CanvasTexture(canvas);

          this.object.material[i] = new THREE.MeshPhongMaterial(
            Object.assign({}, this.materialOptions, { map: texture })
          );
        }
      });

      this.object.material.needsUpdate = true;
    }
  }
}

export class DiceD6 extends DiceObject {
  constructor(options, board) {
    super(options);

    this.faces = this.getFaces();
    this.textMargin = 1.0;
    this.mass = 150;
    this.scaleFactor = 0.9;
    this.sidesPerFace = 4;
    this.verticesPerFace = 6;

    board && this.create(board);
  }

  getFaces() {
    return [
      { value: 1, text: "1" },
      { value: 6, text: "6." },
      { value: 2, text: "2" },
      { value: 5, text: "5" },
      { value: 4, text: "4" },
      { value: 3, text: "3" },
    ];
  }

  createGeometry() {
    const width = this.getRadius() * 1.4;
    this.geometry = new THREE.BoxGeometry(width, width, width);
  }

  setUvs() {}
}

export class DiceD8 extends DiceObject {
  constructor(options, board) {
    super(options);

    this.faces = this.getFaces();
    this.textMargin = 1.2;
    this.mass = 170;
    this.scaleFactor = 1;

    board && this.create(board);
  }

  getFaces() {
    return [
      { value: 1, text: "1" },
      { value: 4, text: "4" },
      { value: 7, text: "7" },
      { value: 6, text: "6" },
      { value: 3, text: "3" },
      { value: 8, text: "8" },
      { value: 5, text: "5" },
      { value: 2, text: "2" },
    ];
  }

  createGeometry() {
    this.geometry = new THREE.OctahedronGeometry(this.getRadius(), 0);
  }
}

export class DiceD10 extends DiceObject {
  constructor(options, board) {
    super(options);

    this.faces = this.getFaces();
    this.textMargin = 1.6;
    this.mass = 175;
    this.scaleFactor = 0.9;
    this.sidesPerFace = 4;
    this.verticesPerFace = 6;

    board && this.create(board);
  }

  getFaces() {
    return [
      { value: 1, text: "1" },
      { value: 7, text: "7" },
      { value: 3, text: "3" },
      { value: 5, text: "5" },
      { value: 9, text: "9." },
      { value: 6, text: "6." },
      { value: 4, text: "4" },
      { value: 10, text: "0" },
      { value: 8, text: "8" },
      { value: 2, text: "2" },
    ];
  }

  createGeometry() {
    this.vertices = [0, 0, 1, 0, 0, -1];

    for (let i = 0; i < 10; ++i) {
      const b = (i * Math.PI * 2) / 10;
      this.vertices.push(-Math.cos(b), -Math.sin(b), 0.105 * (i % 2 ? 1 : -1));
    }

    this.geoFaces = [
      0,
      3,
      4,
      0,
      4,
      5,
      0,
      5,
      6,
      0,
      6,
      7,
      0,
      7,
      8,
      0,
      8,
      9,
      0,
      9,
      10,
      0,
      10,
      11,
      0,
      11,
      2,
      0,
      2,
      3,
      1,
      4,
      3,
      1,
      3,
      2,
      1,
      6,
      5,
      1,
      5,
      4,
      1,
      8,
      7,
      1,
      7,
      6,
      1,
      10,
      9,
      1,
      9,
      8,
      1,
      2,
      11,
      1,
      11,
      10,
    ];

    this.geometry = new THREE.PolyhedronGeometry(
      this.vertices,
      this.geoFaces,
      this.getRadius(),
      0
    );
  }

  getBaseUvs() {
    const p0 = new THREE.Vector3(0, 0, 1);
    const p1 = new THREE.Vector3(
      Math.cos((Math.PI * 2) / 10),
      Math.sin((Math.PI * 2) / 10),
      0.105
    );
    const p2 = new THREE.Vector3(
      Math.cos((Math.PI * 4) / 10),
      Math.sin((Math.PI * 4) / 10),
      -0.105
    );

    const d01 = p0.distanceTo(p1);
    const d02 = p0.distanceTo(p2);

    const l1 = new THREE.Vector3();
    l1.copy(p0).sub(p1);

    const l2 = new THREE.Vector3();
    l2.copy(p0).sub(p2);

    const base = new THREE.Vector2(0.5, 1);
    const point2 = new THREE.Vector2(0.5, 0);
    const pt1 = point2.clone().rotateAround(base, l2.angleTo(l1));
    const t = d01 / d02;
    const x = (1 - t) * base.x + t * pt1.x;
    const y = (1 - t) * base.y + t * pt1.y;
    const point3 = new THREE.Vector2(x, y);
    const point1 = new THREE.Vector2(1 - x, point3.y);

    return [base, point1, point2, point3];
  }
}

export class DiceD12 extends DiceObject {
  constructor(options, board) {
    super(options);

    this.angle = THREE.MathUtils.degToRad(72);
    this.verticesPerFace = 9;
    this.faces = this.getFaces();
    this.textMargin = 0.9;
    this.mass = 175;
    this.scaleFactor = 1;
    this.sidesPerFace = 5;

    board && this.create(board);
  }

  getFaces() {
    return [
      { value: 1, text: "1" },
      { value: 7, text: "7" },
      { value: 5, text: "5" },
      { value: 11, text: "11" },
      { value: 12, text: "12" },
      { value: 6, text: "6." },
      { value: 8, text: "8" },
      { value: 3, text: "3" },
      { value: 9, text: "9." },
      { value: 4, text: "4" },
      { value: 2, text: "2" },
      { value: 10, text: "10" },
    ];
  }

  createGeometry() {
    this.geometry = new THREE.DodecahedronGeometry(this.getRadius(), 0);
  }

  getMaterials() {
    const texture = this.createTextTexture(
      { text: "" },
      this.diceColor,
      this.diceColor,
      this.diceColor
    );

    return [
      ...this.faces.map((face) => face.material),
      new THREE.MeshPhongMaterial(
        Object.assign({}, this.materialOptions, { map: texture })
      ),
    ];
  }
}

export class DiceD20 extends DiceObject {
  constructor(options, board) {
    super(options);

    this.faces = this.getFaces();
    this.textMargin = 1.4;
    this.mass = 200;
    this.scaleFactor = 1;

    board && this.create(board);
  }

  getFaces() {
    return [
      { value: 1, text: "1" },
      { value: 7, text: "7" },
      { value: 15, text: "15" },
      { value: 5, text: "5" },
      { value: 13, text: "13" },
      { value: 17, text: "17" },
      { value: 19, text: "19" },
      { value: 11, text: "11" },
      { value: 18, text: "18" },
      { value: 12, text: "12" },
      { value: 16, text: "16" },
      { value: 6, text: "6." },
      { value: 14, text: "14" },
      { value: 20, text: "20" },
      { value: 8, text: "8" },
      { value: 3, text: "3" },
      { value: 9, text: "9." },
      { value: 4, text: "4" },
      { value: 2, text: "2" },
      { value: 10, text: "10" },
    ];
  }

  createGeometry() {
    this.geometry = new THREE.IcosahedronGeometry(this.getRadius(), 0);
  }
}

export class DiceD20Alt extends DiceD20 {
  getFaces() {
    const faces = super.getFaces();
    return faces.map((face) => {
      switch (face.value) {
        case 1:
          face.text = "\u2620️";
          break;
        case 20:
          face.text = "\u2694";
          break;
      }
      return face;
    });
  }
}

export class DiceD100 extends DiceD10 {
  getFaces() {
    return [
      { value: 10, text: "10", angle: -Math.PI / 2 },
      { value: 70, text: "70", angle: -Math.PI / 2 },
      { value: 90, text: "90", angle: -Math.PI / 2 },
      { value: 30, text: "30", angle: -Math.PI / 2 },
      { value: 50, text: "50", angle: -Math.PI / 2 },
      { value: 100, text: "00", angle: -Math.PI / 2 },
      { value: 60, text: "60", angle: -Math.PI / 2 },
      { value: 40, text: "40", angle: -Math.PI / 2 },
      { value: 80, text: "80", angle: -Math.PI / 2 },
      { value: 20, text: "20", angle: -Math.PI / 2 },
    ];
  }
}
