"use strict";



import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  BoxGeometry,
  Mesh,
  MeshNormalMaterial,
  AmbientLight,
  Clock,
  AxesHelper,
  PlaneGeometry,
  MeshPhongMaterial,
  Vector3,
  Quaternion
} from 'three';

import * as CANNON from 'cannon-es';

import CannonDebugger from 'cannon-es-debugger'

import {
  OrbitControls
} from 'three/addons/controls/OrbitControls.js';

import {
  GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';




// --------------------------- THREE JS  - Global Settings --------------------------------- //
const scene = new Scene();
const aspect = window.innerWidth / window.innerHeight;

const cameraDistance = [0, 3, -5] // Distance between sled and camera
const camera = new PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.set(cameraDistance[0], cameraDistance[1], cameraDistance[2]);

// const axesHelper = new AxesHelper(2);
// scene.add(axesHelper);

const light = new AmbientLight(0xffffff, 1.0); // soft white light
scene.add(light);

const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.listenToKeyEvents(window); // optional

const meshes = []
const bodies = []


// --------------------------- CANNON-ES physics  - Global Settings --------------------------------- //

const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0), // m/s²
})

// const cannonDebugger = new CannonDebugger(scene, world, {
//   // options...
// })

// Material Physics

const groundCannonMaterial = new CANNON.Material('ground')
const slipperyMaterial = new CANNON.Material('slippery')

const ground_ground = new CANNON.ContactMaterial(groundCannonMaterial, groundCannonMaterial, {
  friction: 0.4,
  restitution: 0.3,
  contactEquationStiffness: 1e8,
  contactEquationRelaxation: 3,
  frictionEquationStiffness: 1e8,
  frictionEquationRegularizationTime: 3,
})

// Add contact material to the world
world.addContactMaterial(ground_ground)

const slippery_ground = new CANNON.ContactMaterial(groundCannonMaterial, slipperyMaterial, {
  friction: 0,
  restitution: 0.3,
  contactEquationStiffness: 1e8,
  contactEquationRelaxation: 3,
})

world.addContactMaterial(slippery_ground)






// ----------------------------- SLED ----------------------------- //

// Mesh
const sledLoader = new GLTFLoader()
  .setPath('assets/models/')
  .load('sled_scene.glb', function (gltf) {

    let mesh = null;
    mesh = gltf.scene;

    if (mesh != null) {
      console.log("Model loaded:  " + mesh);
      meshes.push(mesh)
      mesh.castShadow = true
      scene.add(mesh);
    } else {
      console.log("Load FAILED.  ");
    }
  });


// CANNON-ES physics

const sledShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.25, 1.5))
const sledBody = new CANNON.Body({ mass: 5, material: slipperyMaterial })
sledBody.addShape(sledShape)
sledBody.position.set(0, 1, 0)
bodies.push(sledBody)
world.addBody(sledBody)





// ----------------------------- GROUND ----------------------------- //

// Mesh
const groundGeometry = new PlaneGeometry(100, 1000, 1, 1)

const groundMaterial = new MeshPhongMaterial({ color: 0xbbbbdddddff });

const ground = new Mesh(groundGeometry, groundMaterial);
ground.receiveShadow = true

scene.add(ground);


// CANNON-ES physics

const groundShape = new CANNON.Plane()
const groundBody = new CANNON.Body({ mass: 0, material: groundCannonMaterial })
groundBody.addShape(groundShape)
groundBody.quaternion.setFromEuler(-Math.PI / 2.2, 0, 0)

ground.quaternion.copy(groundBody.quaternion)





// ----------------------------- TREES ----------------------------- //

const treeSize = [1, 5, 1]

// Generating trees at random
const nbOfTrees = 150

function addTrees() {
  new GLTFLoader()
    .setPath('assets/models/')
    .load('tree_scene.glb', function (gltf) {

      let mesh = null;
      mesh = gltf.scene;

      if (mesh != null) {

        console.log("Model loaded:  " + mesh);

        for (let i = 0; i < nbOfTrees; i++) {

          // Mesh
          let treeMesh = mesh.clone()
          treeMesh.castShadow = true

          const treePos = [(Math.random() - 0.5) * 50, - (Math.random() * 500 + 5), 2]
          treeMesh.position.set(treePos[0], treePos[1], treePos[2])

          ground.add(treeMesh)


          // CANNON-ES Physics
          const treeShape = new CANNON.Box(new CANNON.Vec3(treeSize[0] / 2, treeSize[1] / 2, treeSize[2] / 2))
          groundBody.addShape(treeShape, new CANNON.Vec3(treePos[0], treePos[1], treePos[2]), groundBody.quaternion)

          treeMesh.quaternion.copy(groundBody.quaternion)
          const upsideDownQuaternion = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
          treeMesh.quaternion.premultiply(upsideDownQuaternion)
        }


      } else {
        console.log("Load FAILED.  ");
      }

    })

};

addTrees();

world.addBody(groundBody)





//----------------------------------------------------------------------------//
// ------------------------------- CONTROLS --------------------------------- //

let moving = null
const handleMovement = (e) => {
  switch (e.key) {
    case 'q':
      moving = "left"
      break;
    case 'd':
      moving = "right"
      break;

  }
};

const stopMovement = (e) => {
  moving = null;

};


window.addEventListener("keydown", handleMovement)
window.addEventListener("keyup", stopMovement)


//----------------------------------------------------------------------------//
// ----------------------------- ANIMATION LOOP ----------------------------- //

const clock = new Clock();

// Main loop
const animation = () => {

  renderer.setAnimationLoop(animation); // requestAnimationFrame() replacement, compatible with XR 

  const delta = clock.getDelta();

  if (moving == "left") {
    sledBody.position.x += 5 * delta;
  }
  if (moving == "right") {
    sledBody.position.x -= 5 * delta;
  } else {

  }

  // const elapsed = clock.getElapsedTime();

  world.fixedStep()
  // cannonDebugger.update()

  for (let i = 0; i !== meshes.length; i++) {
    meshes[i].position.copy(bodies[i].position)
    meshes[i].quaternion.copy(bodies[i].quaternion)
  }


  camera.position.set(sledBody.position.x + cameraDistance[0],
    sledBody.position.y + cameraDistance[1],
    sledBody.position.z + cameraDistance[2])



  renderer.render(scene, camera);
};

animation();

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

}
