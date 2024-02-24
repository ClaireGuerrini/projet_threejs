"use strict";

// Import only what you need, to help your bundler optimize final code size using tree shaking
// see https://developer.mozilla.org/en-US/docs/Glossary/Tree_shaking)

import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  BoxGeometry,
  Mesh,
  MeshNormalMaterial,
  AmbientLight,
  Clock,
  CameraHelper,
  AxesHelper,
  PlaneGeometry,
  MeshPhongMaterial,
  SphereGeometry
} from 'three';

import * as CANNON from 'cannon-es';

import CannonDebugger from 'cannon-es-debugger'

// If you prefer to import the whole library, with the THREE prefix, use the following line instead:
// import * as THREE from 'three'

// NOTE: three/addons alias is supported by Rollup: you can use it interchangeably with three/examples/jsm/  

// Importing Ammo can be tricky.
// Vite supports webassembly: https://vitejs.dev/guide/features.html#webassembly
// so in theory this should work:
//
// import ammoinit from 'three/addons/libs/ammo.wasm.js?init';
// ammoinit().then((AmmoLib) => {
//  Ammo = AmmoLib.exports.Ammo()
// })
//
// But the Ammo lib bundled with the THREE js examples does not seem to export modules properly.
// A solution is to treat this library as a standalone file and copy it using 'vite-plugin-static-copy'.
// See vite.config.js
// 
// Consider using alternatives like Oimo or cannon-es
import {
  OrbitControls
} from 'three/addons/controls/OrbitControls.js';

import {
  GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';

// Example of hard link to official repo for data, if needed
// const MODEL_PATH = 'https://raw.githubusercontent.com/mrdoob/js/r148/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb';

const meshes = []
const bodies = []


const cameraDistance = [0,5,-10] // Distance between sled and camera

// --------------------------- THREE JS---------------------------------
const scene = new Scene();
const aspect = window.innerWidth / window.innerHeight;

const camera = new PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.set(cameraDistance[0],cameraDistance[1],cameraDistance[2]);

// const helper = new CameraHelper( camera ); 
// scene.add( helper );
const axesHelper = new AxesHelper(2);
scene.add(axesHelper);

const light = new AmbientLight(0xffffff, 1.0); // soft white light
scene.add(light);

const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.listenToKeyEvents(window); // optional


// -------- MESHES -----------

// Ground
const groundGeometry = new PlaneGeometry(100, 1000, 1, 1)
// groundGeometry.quaternion.setFromEuler(new Euler(-Math.PI / 2.2, 0, 0, 'XYZ'))

const groundMaterial = new MeshPhongMaterial({ color: 0xeeeeff });

const ground = new Mesh(groundGeometry, groundMaterial);
ground.receiveShadow = true

scene.add(ground);

// Sled
const sledGeometry = new BoxGeometry(1, 0.5, 3, 10, 10)
const sledMaterial = new MeshNormalMaterial();
const sledMesh = new Mesh(sledGeometry, sledMaterial)
sledMesh.castShadow = true
meshes.push(sledMesh)
scene.add(sledMesh)

// Trees

const treeSize = [1, 5, 1]
const treeGeometry = new BoxGeometry(treeSize[0], treeSize[1], treeSize[2], 10, 10)
const treeMaterial = new MeshNormalMaterial();

const treeMeshes = []
const treePositions = []

// Generating trees at random
const nbOfTrees = 150
for (let i = 0; i < nbOfTrees; i++) {
  const treeMesh = new Mesh(treeGeometry, treeMaterial)
  treeMesh.castShadow = true

  const treePos = [(Math.random() - 0.5) * 50, - (Math.random() * 500 + 5), 2]
  treeMesh.position.set(treePos[0], treePos[1], treePos[2])

  ground.add(treeMesh)

  treeMeshes.push(treeMesh)
  treePositions.push(treePos)
}
console.log(treePositions)





// ---------------------CANNON-ES PHYSICS -------------------
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0), // m/s²
})

const cannonDebugger = new CannonDebugger(scene, world, {
  // options...
})

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

// Ground and trees

//ground
const groundShape = new CANNON.Plane()
const groundBody = new CANNON.Body({ mass: 0, material: groundCannonMaterial })
groundBody.addShape(groundShape)
groundBody.quaternion.setFromEuler(-Math.PI / 2.2, 0, 0)

ground.quaternion.copy(groundBody.quaternion)

//trees

for (let i = 0; i < treeMeshes.length; i++) {
  const treeShape = new CANNON.Box(new CANNON.Vec3(treeSize[0] / 2, treeSize[1] / 2, treeSize[2] / 2))
  groundBody.addShape(treeShape, new CANNON.Vec3(treePositions[i][0], treePositions[i][1], treePositions[i][2]), groundBody.quaternion)

  treeMeshes[i].quaternion.copy(groundBody.quaternion)

}


world.addBody(groundBody)



// Sled 

const sledShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.25, 1.5))
const sledBody = new CANNON.Body({ mass: 5, material: slipperyMaterial })
sledBody.addShape(sledShape)
sledBody.position.set(0, 1, 0)
bodies.push(sledBody)
world.addBody(sledBody)

//Trees
// const treeShape = new CANNON.Box(new CANNON.Vec3(0.5, 2.5, 0.5))
// const treeBody = new CANNON.Body({ mass: 5, material: groundCannonMaterial })
// treeBody.addShape(treeShape)
// treeBody.position.set(0, 5, 5)
// bodies.push(treeBody)
// world.addBody(treeBody)


// const sphereShape = new CANNON.Sphere(1)
// const sphereBody = new CANNON.Body({ mass: 5, shape: sphereShape })
// sphereBody.addShape(sphereShape)
// sphereBody.position.set(0, 10, 0)
// bodies.push(sphereBody)
// world.addBody(sphereBody)


// CONTROLS

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



// ANIMATION LOOP

const clock = new Clock();

// Main loop
const animation = () => {

  renderer.setAnimationLoop(animation); // requestAnimationFrame() replacement, compatible with XR 

  const delta = clock.getDelta();

  if (moving == "left") {
    sledBody.position.x += 2*delta;
  }
  if (moving == "right") {
    sledBody.position.x -= 2*delta;
  } else {

  }

  // const elapsed = clock.getElapsedTime();

  world.fixedStep()
  cannonDebugger.update()

  for (let i = 0; i !== meshes.length; i++) {
    meshes[i].position.copy(bodies[i].position)
    meshes[i].quaternion.copy(bodies[i].quaternion)
  }


  camera.position.set(sledBody.position.x + cameraDistance[0],
    sledBody.position.y + cameraDistance[1],
    sledBody.position.z + cameraDistance[2])

  // camera.position.z = sledBody.position.z + cameraDistance[2]


  renderer.render(scene, camera);
};

animation();

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

}
