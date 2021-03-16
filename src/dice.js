"use strict";
import * as CANNON from "cannon";
import * as THREE from "three";
import {uniqBy} from 'lodash'
import {ConvexGeometry} from "three/examples/jsm/geometries/ConvexGeometry";
import {ConvexHull} from "three/examples/jsm/math/ConvexHull";

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
        });

        this.geometry = null;
        this.object = null;
        this.body = null;

        this.verticesPerFace = 3;

        this.size = options.size;
        this.scaleFactor = 1;
        this.invertUpside = false;

        this.materialOptions = {
            specular: 0x172022,
            color: 0xf0f0f0,
            shininess: 40,
            flatShading: THREE.FlatShading,
        };
        this.labelColor = options.fontColor;
        this.diceColor = options.backColor;
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

    setUvs() {
        const uvs = [];
        new Array(this.faces.length).fill().forEach((i, index) => {
            this.geometry.addGroup(
                index * this.verticesPerFace,
                this.verticesPerFace,
                index
            );
            uvs.push(
                (Math.cos(this.af) + 1 + this.tab) / 2 / (1 + this.tab),
                (Math.sin(this.af) + 1 + this.tab) / 2 / (1 + this.tab),
                (Math.cos((Math.PI * 2) / 3 + this.af) + 1 + this.tab) /
                2 /
                (1 + this.tab),
                (Math.sin((Math.PI * 2) / 3 + this.af) + 1 + this.tab) /
                2 /
                (1 + this.tab),
                (Math.cos(((Math.PI * 2) / 3) * 2 + this.af) + 1 + this.tab) /
                2 /
                (1 + this.tab),
                (Math.sin(((Math.PI * 2) / 3) * 2 + this.af) + 1 + this.tab) /
                2 /
                (1 + this.tab)
            );
        });
        const uvNumComponents = 2;
        this.geometry.setAttribute(
            "uv",
            new THREE.BufferAttribute(new Float32Array(uvs), uvNumComponents)
        );
    }

    getPolyhedronShape() {
        const position = this.object.geometry.attributes.position.array;

        const pointsArray = [];
        for (let i = 0; i < position.length; i += 3) {
            pointsArray.push(
                [position[i], position[i + 1], position[i + 2]]
            );
        }
        const uniqVertices = uniqBy(pointsArray, p => `${p[0]}_${p[1]}_${p[2]}`)
        const points = uniqVertices.map(point => new THREE.Vector3(...point));
        const cannonPoints = uniqVertices.map(point => new CANNON.Vec3(...point));
        const convexHull = new ConvexHull().setFromPoints( points );

        const faces = convexHull.faces.map(face => {
            const p1 = face.edge.prev.vertex.point;
            const v1 = points.findIndex(p =>
                p.x === p1.x &&
                p.y === p1.y &&
                p.z === p1.z
            )
            const p2 = face.edge.vertex.point
            const v2 = points.findIndex(p =>
                p.x === p2.x &&
                p.y === p2.y &&
                p.z === p2.z
            )
            const p3 = face.edge.next.vertex.point
            const v3 = points.findIndex(p =>
                p.x === p3.x &&
                p.y === p3.y &&
                p.z === p3.z
            )
            return [v1, v2, v3]
        })

        return new CANNON.ConvexPolyhedron(cannonPoints, faces)

        // const position = this.object.geometry.attributes.position.array;
        // // console.log(position)
        // const points = [];
        // for (let i = 0; i < position.length; i += 3) {
        //     points.push(
        //         new CANNON.Vec3(position[i], position[i + 1], position[i + 2])
        //     );
        // }
        // const faces = [];
        // for (let i = 0; i < position.length / 3; i += 3) {
        //     faces.push([i, i + 1, i + 2]);
        // }
        //
        // return new CANNON.ConvexPolyhedron(points, faces);

        // const vertices = this.object.geometry.attributes.position.array
        // const indices = Object.keys(vertices).map(Number);
        // return new CANNON.Trimesh(vertices, indices);

        //
        // const position = this.geometry.attributes.position;
        // let vertices = []
        // for (let i = 0; i < position.count; i++) {
        //     vertices.push(new THREE.Vector3().fromBufferAttribute(position, i));
        // }
        // const convexHull = new ConvexHull().setFromPoints( vertices );
        // const faces = convexHull.faces;
        //
        // const verticesMap = {}
        // const points = []
        // const changes = [];
        // for (let i = 0, il = vertices.length; i < il; i++) {
        //     const v = vertices[i];
        //     const key = Math.round(v.x * 100) + '_' + Math.round(v.y * 100) + '_' + Math.round(v.z * 100);
        //     if (verticesMap[key] === undefined) {
        //         verticesMap[key] = i;
        //         points.push(new CANNON.Vec3(vertices[i].x, vertices[i].y, vertices[i].z));
        //         changes[i] = points.length - 1;
        //     } else {
        //         changes[i] = changes[verticesMap[key]];
        //     }
        // }
        //
        // console.log(vertices, faces, faces.map(face => [face.a, face.b, face.c]))
        //
        //
        // const cannonFaces = faces.map(function (f) {
        //     return [f.a, f.b, f.c]
        // })
        // console.log(cannonFaces)
        //
        // return new CANNON.ConvexPolyhedron(points, faces);

    }

    updateBodyFromMesh() {
        this.body.position.copy(this.object.position);
        this.body.quaternion.copy(this.object.quaternion);
    }

    calculateTextureSize(approx) {
        return Math.max(
            64,
            Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)))
        );
    }

    createTextTexture(text, color, backColor) {
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
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        return new THREE.CanvasTexture(canvas);
    }

    getMaterials() {
        return this.faces.map(face => {
            let texture = null;
            if (this.customTextTextureFunction) {
                texture = this.customTextTextureFunction(
                    face.text,
                    this.labelColor,
                    this.diceColor
                );
            } else {
                texture = this.createTextTexture(
                    face.text,
                    this.labelColor,
                    this.diceColor
                );
            }

            return new THREE.MeshPhongMaterial(
                Object.assign({}, this.materialOptions, {map: texture})
            );
        });
    }

    getFace(index) {
        return this.faces[index];
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

    create(board) {
        this.geometry = new THREE.IcosahedronGeometry(this.getRadius(), 0);
        // this.geometry.computeFaceNormals();
        this.setUvs();

        this.object = new THREE.Mesh(this.geometry, this.getMaterials());
        board.scene.add(this.object);

        this.object.reveiceShadow = true;
        this.object.castShadow = true;

        this.body = new CANNON.Body({
            mass: board.gravityFactor * this.mass / 1000,
            material: board.diceBodyMaterial,
        });
        this.body.linearDamping = 0.1;
        this.body.angularDamping = 0.1;
        this.body.addShape(new CANNON.Sphere(this.getRadius() * .7), new CANNON.Vec3(0, 0, 0));
        this.body.addShape(this.getPolyhedronShape());

        board.dice.push(this);
        board.world.addBody(this.body);

        return this.object;
    }
}

export class DiceD20 extends DiceObject {
    constructor(options, board) {
        super(options);

        this.tab = -0.3;
        this.af = -Math.PI / 4 / 2;
        this.faces = [
            {value: 1, text: "1"},
            {value: 7, text: "7"},
            {value: 15, text: "15"},
            {value: 5, text: "5"},
            {value: 13, text: "13"},
            {value: 17, text: "17"},
            {value: 19, text: "19"},
            {value: 11, text: "11"},
            {value: 18, text: "18"},
            {value: 12, text: "12"},
            {value: 16, text: "16"},
            {value: 6, text: "6."},
            {value: 14, text: "14"},
            {value: 20, text: "20"},
            {value: 8, text: "8"},
            {value: 3, text: "3"},
            {value: 9, text: "9."},
            {value: 4, text: "4"},
            {value: 2, text: "2"},
            {value: 10, text: "10"},
        ];
        this.textMargin = 1.0;
        this.mass = 200;
        this.scaleFactor = 1;

        board && this.create(board);
    }
}
