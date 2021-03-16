import "./styles.css";
import {DiceD20} from "./dice";
import * as THREE from "three";
import {Board} from "./board";

const container = document.getElementById("ThreeJS");
const board = new Board({debug: false, container: container});

board.render();

container.addEventListener('click', () => {
    board.clear();

    const dices = [
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
        new DiceD20({}, board),
    ];

    board.throwDice(values => console.log(values));
}, false)

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    let delta = clock.getDelta();
    if (delta > 0.1) delta = 0.1;
    board.world.step(delta);

    if (board.isThrowing) {
        const isFinished = board.isFinished()

        if (!isFinished) {
            board.dice.forEach(die => {
                die.object.position.copy(die.body.position);
                die.object.quaternion.copy(die.body.quaternion);
            })
        }
    }
    board.render();

    board.controls && board.controls.update();
    board.stats && board.stats.update();
}

animate();