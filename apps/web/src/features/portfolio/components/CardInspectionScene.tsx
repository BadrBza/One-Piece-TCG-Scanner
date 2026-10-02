import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl, Environment, Lightformer } from '@react-three/drei';
import { Shape, ShapeGeometry, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { request } from '../../../lib/http';

export type ErreurInspection = 'image' | 'scene';

export type CommandesCarte = {
  afficherFace: (verso: boolean) => void;
  zoomer: (direction: number) => void;
  tourner: (horizontal: number, vertical: number) => void;
  reinitialiser: () => void;
};

type Props = {
  ref: Ref<CommandesCarte>;
  imageUrl: string;
  cardmarketProductId?: number;
  dos: { imageUrl: string };
  mouvementReduit: boolean;
  onReady: (pret: boolean) => void;
  onError: (cause: ErreurInspection) => void;
};

const LARGEUR = 6.3;
const HAUTEUR = 8.8;
const EPAISSEUR = 0.035;
const extrusion = { depth: EPAISSEUR, bevelEnabled: false, steps: 1, curveSegments: 12 };
const { ACTION } = CameraControlsImpl;
const souris = { left: ACTION.ROTATE, middle: ACTION.DOLLY, right: ACTION.NONE, wheel: ACTION.DOLLY };
const tactile = { one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY, three: ACTION.NONE };

export default function CardInspectionScene({ imageUrl, cardmarketProductId, dos, ...props }: Props) {
  const [textures, setTextures] = useState<Texture[] | null>(null);

  useEffect(() => {
    let actif = true;
    const annulation = new AbortController();
    const chargees: Texture[] = [];
    const chargeur = new TextureLoader();
    const charger = async (url: string) => {
      const texture = await chargeur.loadAsync(url);
      if (!actif) { texture.dispose(); return texture; }
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 2;
      chargees.push(texture);
      return texture;
    };
    const chargerRecto = async () => {
      if (cardmarketProductId === undefined) return charger(imageUrl);
      // Les images Cardmarket visibles dans <img> ne sont pas forcément autorisées dans WebGL.
      const { image } = await request<{ image: string }>(`/cards/${cardmarketProductId}/image`, {
        signal: annulation.signal,
        timeout: 20_000,
      });
      if (actif) return charger(image);
    };
    // Textures propres à cette inspection : pas de cache GPU qui grossit entre les cartes.
    Promise.all([chargerRecto(), charger(dos.imageUrl)]).then(([recto, verso]) => {
      if (!actif || !recto) return;
      setTextures([recto, verso]);
    }).catch(() => { if (actif) props.onError('image'); });
    return () => { actif = false; annulation.abort(); chargees.forEach(texture => texture.dispose()); };
  }, [imageUrl, cardmarketProductId, dos, props.onError]);

  if (!textures) return null;
  return (
    <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 0, 18], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }} style={{ touchAction: 'none' }}>
      <VueCarte {...props} textures={textures} />
    </Canvas>
  );
}

function VueCarte({ ref, textures, mouvementReduit, onReady, onError }: Omit<Props, 'imageUrl' | 'cardmarketProductId' | 'dos'> & { textures: Texture[] }) {
  const controles = useRef<CameraControlsImpl>(null);
  const { gl, size, invalidate } = useThree();
  const distanceInitiale = Math.max(HAUTEUR, LARGEUR / (size.width / size.height)) / (2 * Math.tan(35 * Math.PI / 360)) * 1.25;
  const contour = useMemo(creerContour, []);
  const face = useMemo(() => {
    const geometrie = new ShapeGeometry(contour, 12);
    const positions = geometrie.getAttribute('position');
    const uv = geometrie.getAttribute('uv');
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, positions.getX(index) / LARGEUR + 0.5, positions.getY(index) / HAUTEUR + 0.5);
    }
    return geometrie;
  }, [contour]);

  useEffect(() => () => face.dispose(), [face]);
  useEffect(() => {
    const perteContexte = (event: Event) => { event.preventDefault(); onError('scene'); };
    gl.domElement.addEventListener('webglcontextlost', perteContexte);
    onReady(true);
    return () => gl.domElement.removeEventListener('webglcontextlost', perteContexte);
  }, [gl, onReady, onError]);

  useEffect(() => {
    const camera = controles.current!;
    camera.minDistance = distanceInitiale * 0.55;
    camera.maxDistance = distanceInitiale * 1.65;
    void camera.setLookAt(0, 0, distanceInitiale, 0, 0, 0, false);
    invalidate();
  }, [distanceInitiale, invalidate]);

  useImperativeHandle(ref, () => ({
    afficherFace(verso) {
      const camera = controles.current!;
      camera.normalizeRotations();
      void camera.rotateTo(verso ? Math.PI : 0, Math.PI / 2, !mouvementReduit);
      invalidate();
    },
    zoomer(direction) {
      void controles.current?.dolly(direction * distanceInitiale * 0.12, !mouvementReduit);
      invalidate();
    },
    tourner(horizontal, vertical) {
      void controles.current?.rotate(horizontal, vertical, !mouvementReduit);
      invalidate();
    },
    reinitialiser() {
      const camera = controles.current!;
      camera.normalizeRotations();
      void camera.setLookAt(0, 0, distanceInitiale, 0, 0, 0, !mouvementReduit);
      invalidate();
    },
  }), [distanceInitiale, invalidate, mouvementReduit]);

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 8]} intensity={2} />
      <directionalLight position={[-3, 3, -8]} intensity={2} />
      <Environment resolution={128} frames={1}>
        <Lightformer position={[-3, 2, 5]} rotation={[0, Math.PI, 0]} scale={[3, 8, 1]} intensity={2} />
        <Lightformer position={[3, 2, -5]} scale={[3, 8, 1]} intensity={2} />
      </Environment>
      <mesh position-z={-EPAISSEUR / 2}>
        <extrudeGeometry args={[contour, extrusion]} />
        <meshStandardMaterial color="#d4d1c7" roughness={0.85} />
      </mesh>
      {textures.map((texture, index) => (
        <mesh key={index} geometry={face} position-z={(index === 0 ? 1 : -1) * (EPAISSEUR / 2 + 0.002)} rotation-y={index === 0 ? 0 : Math.PI}>
          <meshPhysicalMaterial map={texture} roughness={0.6} metalness={0} clearcoat={0.22} clearcoatRoughness={0.3} envMapIntensity={0.35} />
        </mesh>
      ))}
      <CameraControls ref={controles} makeDefault mouseButtons={souris} touches={tactile}
        minPolarAngle={0.2} maxPolarAngle={Math.PI - 0.2} dollyToCursor={false}
        smoothTime={mouvementReduit ? 0 : 0.18} draggingSmoothTime={mouvementReduit ? 0 : 0.08} />
    </>
  );
}

function creerContour() {
  const x = LARGEUR / 2;
  const y = HAUTEUR / 2;
  const rayon = 0.25;
  return new Shape().moveTo(-x + rayon, -y).lineTo(x - rayon, -y)
    .quadraticCurveTo(x, -y, x, -y + rayon).lineTo(x, y - rayon)
    .quadraticCurveTo(x, y, x - rayon, y).lineTo(-x + rayon, y)
    .quadraticCurveTo(-x, y, -x, y - rayon).lineTo(-x, -y + rayon)
    .quadraticCurveTo(-x, -y, -x + rayon, -y);
}
