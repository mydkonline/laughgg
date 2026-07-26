import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* 상품이 3D 에셋이니 그림도 실제 모델을 렌더해서 쓴다.
   WebGL 컨텍스트는 브라우저당 몇 개 안 되므로 렌더러 하나를 돌려 쓰고,
   결과는 data URL 로 캐시한다. 같은 모델·같은 각도는 다시 굽지 않는다. */

/* 정사각으로 굽는다. 카드도 정사각이라 contain 여백이 피사체마다 안 흔들린다. */
const W = 480;
const H = 480;

export type Dir = readonly [number, number, number];
export type Material = "pbr" | "wire";

type Rig = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  loader: GLTFLoader;
};

let rigPromise: Promise<Rig> | null = null;
const bakeCache = new Map<string, string>();
const gltfCache = new Map<string, Promise<THREE.Group>>();

async function rig(): Promise<Rig> {
  rigPromise ??= (async () => {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);

    /* HDRI 가 있으면 그걸 쓰고, 못 받으면 내장 스튜디오로 떨어진다.
       환경광이 없으면 PBR 재질이 전부 새까맣게 나온다. */
    await new Promise<void>((done) => {
      new HDRLoader().load(
        `${import.meta.env.BASE_URL}assets/ph/studio_1k.hdr`,
        (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          scene.environment = pmrem.fromEquirectangular(tex).texture;
          tex.dispose();
          done();
        },
        undefined,
        () => {
          scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
          done();
        },
      );
    });

    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(0.8, 1.2, 0.9);
    scene.add(key);

    return {
      renderer,
      scene,
      camera: new THREE.PerspectiveCamera(30, 1, 0.01, 100),
      loader: new GLTFLoader(),
    };
  })();
  return rigPromise;
}

/** 모델을 원점 중심·최대변 1 로 정규화해 돌려준다. 같은 주소는 한 번만 받는다. */
export async function loadNormalized(url: string): Promise<THREE.Group> {
  let p = gltfCache.get(url);
  if (!p) {
    p = (async () => {
      const { loader } = await rig();
      const gltf = await loader.loadAsync(url);
      const o = gltf.scene;
      const box = new THREE.Box3().setFromObject(o);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      o.position.set(-center.x, -center.y, -center.z);
      const group = new THREE.Group();
      group.add(o);
      group.scale.setScalar(1 / Math.max(size.x, size.y, size.z, 1e-6));
      return group;
    })();
    gltfCache.set(url, p);
  }
  /* 여러 장면이 같은 노드를 동시에 붙이면 서로 부모를 뺏는다. 사본을 준다. */
  return (await p).clone(true);
}

/** 경계구에 카메라를 맞춘다. 모델마다 크기가 제각각이라 고정 거리로는 잘린다. */
export function frame(camera: THREE.PerspectiveCamera, node: THREE.Object3D, dir: Dir, margin = 1.04) {
  const sphere = new THREE.Box3().setFromObject(node).getBoundingSphere(new THREE.Sphere());
  const fov = (camera.fov * Math.PI) / 180;
  const dist = (sphere.radius / Math.sin(fov / 2)) * margin;
  camera.position.copy(sphere.center).addScaledVector(new THREE.Vector3(...dir).normalize(), dist);
  camera.near = Math.max(dist - sphere.radius * 2, 0.01);
  camera.far = dist + sphere.radius * 4;
  camera.updateProjectionMatrix();
  camera.lookAt(sphere.center);
  return sphere;
}

/** 한 각도를 구워 data URL 로 준다. 갤러리와 목록 썸네일이 같이 쓴다. */
export async function bakeView(url: string, dir: Dir, material: Material = "pbr"): Promise<string> {
  const cacheKey = `${url}|${dir.join(",")}|${material}`;
  const hit = bakeCache.get(cacheKey);
  if (hit) return hit;

  const { renderer, scene, camera } = await rig();
  const node = await loadNormalized(url);

  node.traverse((x) => {
    if (!(x instanceof THREE.Mesh)) return;
    if (material === "wire") {
      x.material = new THREE.MeshBasicMaterial({ color: 0x7d59ea, wireframe: true });
    } else if (!Array.isArray(x.material) && "envMapIntensity" in x.material) {
      (x.material as THREE.MeshStandardMaterial).envMapIntensity = 1.1;
    }
  });

  scene.add(node);
  frame(camera, node, dir);
  renderer.render(scene, camera);
  const png = renderer.domElement.toDataURL("image/png");
  scene.remove(node);

  bakeCache.set(cacheKey, png);
  return png;
}
