import "./styles.css";
import {
  DiceAction,
  DiceD10,
  DiceD100,
  DiceD12,
  DiceD20,
  DiceD20Alt,
  DiceD4,
  DiceD6,
  DiceD8,
  DiceDirection,
} from "./dice";
import * as THREE from "three";
import { Board } from "./board";

const container = document.getElementById("ThreeJS");
const board = new Board({ debug: false, container: container });

board.render();

container.addEventListener(
  "click",
  () => {
    board.clear();

    const dice = [
      new DiceD4({}, board),
      new DiceD6({}, board),
      new DiceD8({}, board),
      new DiceD10({}, board),
      new DiceD12({}, board),
      new DiceD20({}, board),
      new DiceD100({}, board),
      new DiceDirection({}, board),
      new DiceAction({}, board),
    ];

    board.throwDice((values) => console.log(values));
    // board.showDice();
    // dice[1].setAnimation(0)
  },
  false
);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  let delta = clock.getDelta();
  if (delta > 0.1) delta = 0.1;
  board.world.step(delta);

  if (board.isThrowing) {
    const isFinished = board.isFinished();

    if (!isFinished) {
      board.dice.forEach((die) => {
        die.object.position.copy(die.body.position);
        die.object.quaternion.copy(die.body.quaternion);
      });
    }
  }
  board.render();

  board.controls && board.controls.update();
  board.stats && board.stats.update();
}

animate();
