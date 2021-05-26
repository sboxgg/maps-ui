import {
    Euler,
    EventDispatcher,
    Vector3
} from 'three';
import {radToDeg, degToRad} from "three/src/math/MathUtils";

import {addError} from './funcs';

const NoclipControls = function (camera, domElement) {

    this.domElement = domElement;
    this.isLocked = false;

    // pitch is 0 to Math.PI radians

    const ONE_DEG_RAD = degToRad(5);

    this.minPolarAngle = -1 * Math.PI;// + ONE_DEG_RAD; // radians
    this.maxPolarAngle = Math.PI;// - ONE_DEG_RAD; // radians

    this.pitch = 0;
    this.yaw = 0;

    this.controlSpeedMultiplier = 0.2;
    this.shiftSpeedMultipier = 5;

    this.inMotion = {
        forward: 0,
        right: 0,
    };
    this.isFastHeld = false;
    this.isSlowHeld = false;

    const $helpNoclip = document.body.querySelector('.help-noclip');

    const changeEvent = {type: 'change'};
    const lockEvent = {type: 'lock'};
    const unlockEvent = {type: 'unlock'};
    const doneMovingEvent = {type: 'doneMoving'};


    const euler = new Euler(0, 0, 0, 'YXZ');
    // euler.setFromQuaternion(camera.quaternion);

    const PI2 = 2 * Math.PI;
    const PI_2 = Math.PI / 2;

    const vec = new Vector3();

    this.setPitchYaw = (pitch, yaw)=>{
        this.pitch = pitch;
        this.yaw = yaw;
    }

    const onMouseMove = (event) => {
        // exit early if not in noclip mode
        if (this.isLocked === false) {
            return;
        }

        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        // euler.setFromQuaternion(camera.quaternion);

        this.yaw -= movementX * 0.001;
        this.pitch -= movementY * 0.001;

        this.pitch = Math.min(PI_2, Math.max(-1 * PI_2, this.pitch));

        if(this.yaw > PI2) {
            this.yaw -= PI2;
        }
        if(this.yaw < 0) {
            this.yaw += PI2;
        }
        euler.x = this.pitch;
        euler.y = this.yaw;
        camera.setRotationFromEuler(euler);

        this.dispatchEvent(changeEvent);
    }

    this.onMouseDown = (event) => {
        // left click activates noclip mode
        if (event.button === 0) {
            this.lock();
        }
    }

    this.onMouseUp = (event) => {
        // lifting left click deactivates noclip
        if (event.button === 0) {
            this.inMotion.forward = 0;
            this.inMotion.right = 0;
            this.shiftHeld = false;
            this.unlock();
            this.dispatchEvent(doneMovingEvent);
        }
    }

    this.onKeyDown = (event) => {
        // if in noclip mode
        if (this.isLocked) {
            switch (event.code) {
                case 'KeyW':
                    this.inMotion.forward = 1;
                    break;
                case 'KeyS':
                    this.inMotion.forward = -1;
                    break;
                case 'KeyD':
                    this.inMotion.right = 1;
                    break;
                case 'KeyA':
                    this.inMotion.right = -1;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.isFastHeld = true;
                    break;
                case 'Space':
                    this.isSlowHeld = true;
                    break;
            }
        } else {
            // user is trying to move, but not holding left mouse button
            $helpNoclip.classList.add('highlight');
        }
    }
    this.onKeyUp = (event) => {
        // based on key, reset the movement values
        switch (event.code) {
            case 'KeyW':
            case 'KeyS':
                this.inMotion.forward = 0;
                break;
            case 'KeyD':
            case 'KeyA':
                this.inMotion.right = 0;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.isFastHeld = false;
                break;
            case 'Space':
                this.isSlowHeld = false;
                break;
        }
        // if no keys pressed anymore, trigger url update
        if (!this.inMotion.forward && !this.inMotion.right && !this.isFastHeld && !this.isSlowHeld) {
            this.dispatchEvent(doneMovingEvent);
        }
    }

    this.update = (dt) => {
        const speedMultiplier = (
            this.isSlowHeld ? this.controlSpeedMultiplier : (
                this.isFastHeld ? this.shiftSpeedMultipier : 1
            )
        ) * dt * 10;
        const moveForwardDist = this.inMotion.forward * speedMultiplier;
        const moveRightDist = this.inMotion.right * speedMultiplier;
        if (moveForwardDist) {
            this.moveForward(moveForwardDist);
        }
        if (moveRightDist) {
            this.moveRight(moveRightDist);
        }

        const hasChangedPos = moveForwardDist || moveRightDist;

        return hasChangedPos;
    };

    const onPointerlockChange = () => {
        if (this.domElement.ownerDocument.pointerLockElement === this.domElement) {
            this.dispatchEvent(lockEvent);
            this.isLocked = true;
        } else {
            this.dispatchEvent(unlockEvent);
            this.isLocked = false;
        }
    };

    const onPointerlockError = () => {
        addError('The Pointer Lock API is required to activate noclip, but couldn\'t be accessed.');
    };

    this.connect = () => {
        this.domElement.ownerDocument.addEventListener('mousemove', onMouseMove);
        this.domElement.ownerDocument.addEventListener('pointerlockchange', onPointerlockChange);
        this.domElement.ownerDocument.addEventListener('pointerlockerror', onPointerlockError);
        // this.domElement.ownerDocument.addEventListener('mousedown', this.onMouseDown);
        // this.domElement.ownerDocument.addEventListener('mouseup', this.onMouseUp);
        this.domElement.addEventListener('mousedown', this.onMouseDown);
        this.domElement.addEventListener('mouseup', this.onMouseUp);
        this.domElement.ownerDocument.addEventListener('keydown', this.onKeyDown);
        this.domElement.ownerDocument.addEventListener('keyup', this.onKeyUp);
    };

    this.disconnect = () => {
        this.domElement.ownerDocument.removeEventListener('mousemove', onMouseMove);
        this.domElement.ownerDocument.removeEventListener('pointerlockchange', onPointerlockChange);
        this.domElement.ownerDocument.removeEventListener('pointerlockerror', onPointerlockError);
        // this.domElement.ownerDocument.addEventListener('mousedown', this.onMouseDown);
        // this.domElement.ownerDocument.addEventListener('mouseup', this.onMouseUp);
        this.domElement.addEventListener('mousedown', this.onMouseDown);
        this.domElement.addEventListener('mouseup', this.onMouseUp);
        this.domElement.ownerDocument.addEventListener('keydown', this.onKeyDown);
        this.domElement.ownerDocument.addEventListener('keyup', this.onKeyUp);
    };

    this.dispose = () => {
        this.disconnect();
    };

    this.getObject = () => {
        return camera;
    };

    // this.getDirection = function () {
    //     const direction = new Vector3(0, 0, -1);
    //     return (v) => {
    //         return v.copy(direction).applyQuaternion(camera.quaternion);
    //     };
    // }();

    this.moveForward = (distance) => {
        vec.setFromMatrixColumn(camera.projectionMatrix, 0);
        vec.crossVectors(camera.up, vec);
        vec.applyEuler(camera.rotation);
        camera.position.addScaledVector(vec, distance);
    };

    this.moveRight = (distance) => {
        vec.setFromMatrixColumn(camera.matrix, 0);
        camera.position.addScaledVector(vec, distance);
    };

    this.lock = function () {
        this.domElement.requestPointerLock();
        $helpNoclip.classList.remove('highlight');
    };

    this.unlock = function () {
        this.domElement.ownerDocument.exitPointerLock();
    };

    this.connect();
};

NoclipControls.prototype = Object.create(EventDispatcher.prototype);
NoclipControls.prototype.constructor = NoclipControls;

export {NoclipControls};
