import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cameraAt, damp, layers, smoothstep, SUBSTATION_POS, type Vec3 } from './scenes'
import { buildWorld } from './world'
import { SUBSTATION_ASSETS, SUBSTATION_LINKS } from './substation'

const NAVY = '#0b1424'
const TEAL = '#37c6c0'
const AMBER = '#f4b860'
const STEEL = '#3a5680'

type Props = {
  /** Raw scroll progress 0..1, written by the scroll driver. */
  progress: MutableRefObject<number>
  active: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  onContextLost: () => void
}

/** The whole experience is one world and one camera, so scenes are connected by movement, not cuts. */
export default function CinematicCanvas({
  progress,
  active,
  selectedId,
  onSelect,
  onContextLost,
}: Props) {
  const smooth = useRef(0)
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 48, near: 0.1, far: 220, position: [3, 8, 64] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          onContextLost()
        })
      }}
      aria-hidden
    >
      <color attach="background" args={[NAVY]} />
      <fog attach="fog" args={[NAVY, 38, 120]} />
      <Rig progress={progress} smooth={smooth} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[18, 30, 20]} intensity={1.15} color="#dce9ff" />
      <pointLight
        position={[SUBSTATION_POS[0], 7, SUBSTATION_POS[2] + 3]}
        intensity={36}
        color={AMBER}
        distance={26}
      />
      <Floor smooth={smooth} />
      <Network smooth={smooth} />
      <Substation smooth={smooth} selectedId={selectedId} onSelect={onSelect} />
    </Canvas>
  )
}

function Rig({
  progress,
  smooth,
}: {
  progress: MutableRefObject<number>
  smooth: MutableRefObject<number>
}) {
  const camera = useThree((s) => s.camera)
  const look = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    smooth.current = damp(smooth.current, progress.current, 6, Math.min(dt, 0.05))
    const { pos, look: target } = cameraAt(smooth.current)
    const t = state.clock.elapsedTime
    // Restrained handheld drift so the world is never perfectly still.
    camera.position.set(
      pos[0] + Math.sin(t * 0.21) * 0.35,
      pos[1] + Math.sin(t * 0.17) * 0.18,
      pos[2],
    )
    look.set(target[0], target[1], target[2])
    camera.lookAt(look)
  })
  return null
}

function Floor({ smooth }: { smooth: MutableRefObject<number> }) {
  const material = useRef<THREE.LineBasicMaterial>(null)
  const geometry = useMemo(() => {
    const points: number[] = []
    const size = 150
    const step = 6
    for (let i = -size; i <= size; i += step) {
      points.push(-size, 0, i, size, 0, i, i, 0, -size, i, 0, size)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => {
    if (material.current)
      material.current.opacity = 0.16 + 0.1 * smoothstep(0.3, 0.7, smooth.current)
  })
  return (
    <lineSegments geometry={geometry} position={[0, -0.02, 0]}>
      <lineBasicMaterial ref={material} color="#2a4670" transparent opacity={0.16} />
    </lineSegments>
  )
}

function Network({ smooth }: { smooth: MutableRefObject<number> }) {
  const world = useMemo(() => buildWorld(), [])
  const nodes = useRef<THREE.InstancedMesh>(null)
  const pulses = useRef<THREE.InstancedMesh>(null)
  const lineMaterial = useRef<THREE.LineBasicMaterial>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const PULSES = 34

  const lines = useMemo(() => {
    const positions = new Float32Array(world.edges.length * 6)
    const colors = new Float32Array(world.edges.length * 6)
    world.edges.forEach((e, i) => {
      const a = world.nodes[e.a].pos
      const b = world.nodes[e.b].pos
      positions.set([...a, ...b], i * 6)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [world])
  useEffect(() => () => lines.dispose(), [lines])

  const pulseEdge = useMemo(
    () => Array.from({ length: PULSES }, (_, i) => (i * 7 + 3) % world.edges.length),
    [world],
  )
  const teal = useMemo(() => new THREE.Color(TEAL), [])
  const amber = useMemo(() => new THREE.Color(AMBER), [])
  const scratch = useMemo(() => new THREE.Color(), [])
  const camera = useThree((s) => s.camera)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // The opening plays by itself on load; scrolling then keeps the network visible but recedes it.
    const intro = Math.min(1, t / 5)
    const reveal = intro * 1.15
    const visibility = layers(smooth.current).network
    const mesh = nodes.current
    if (mesh) {
      world.nodes.forEach((n, i) => {
        const lit = smoothstep(n.delay, n.delay + 0.12, reveal)
        const flicker = 0.85 + 0.15 * Math.sin(t * 1.6 + i * 1.7)
        // Nodes shrink and fade as the camera passes close, so the fly-through never fills the frame.
        const d = Math.hypot(
          n.pos[0] - camera.position.x,
          n.pos[1] - camera.position.y,
          n.pos[2] - camera.position.z,
        )
        const near = smoothstep(3, 22, d)
        const s =
          (n.kind === 'substation' ? 1.5 * (1 - layers(smooth.current).substation) : 0.55) *
          lit *
          flicker *
          (0.15 + 0.85 * near)
        dummy.position.set(n.pos[0], n.pos[1], n.pos[2])
        dummy.scale.setScalar(Math.max(0.0001, s))
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        scratch.copy(n.kind === 'power' || n.kind === 'substation' ? amber : teal)
        scratch.multiplyScalar((0.35 + 0.65 * lit) * visibility * (0.3 + 0.7 * near))
        mesh.setColorAt(i, scratch)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    const colorAttr = lines.getAttribute('color') as THREE.BufferAttribute
    world.edges.forEach((e, i) => {
      const lit = smoothstep(e.delay, e.delay + 0.15, reveal)
      const k = lit * 0.55 * visibility
      colorAttr.setXYZ(i * 2, teal.r * k, teal.g * k, teal.b * k)
      colorAttr.setXYZ(i * 2 + 1, teal.r * k, teal.g * k, teal.b * k)
    })
    colorAttr.needsUpdate = true
    const dots = pulses.current
    if (dots) {
      pulseEdge.forEach((edgeIndex, i) => {
        const e = world.edges[edgeIndex]
        const a = world.nodes[e.a].pos
        const b = world.nodes[e.b].pos
        const f = (t * 0.22 + i * 0.37) % 1
        const lit = smoothstep(e.delay + 0.1, e.delay + 0.25, reveal) * visibility
        dummy.position.set(
          a[0] + (b[0] - a[0]) * f,
          a[1] + (b[1] - a[1]) * f,
          a[2] + (b[2] - a[2]) * f,
        )
        const dp = Math.hypot(
          dummy.position.x - camera.position.x,
          dummy.position.y - camera.position.y,
          dummy.position.z - camera.position.z,
        )
        dummy.scale.setScalar(Math.max(0.0001, 0.3 * lit * (0.2 + 0.8 * smoothstep(3, 18, dp))))
        dummy.updateMatrix()
        dots.setMatrixAt(i, dummy.matrix)
      })
      dots.instanceMatrix.needsUpdate = true
    }
    if (lineMaterial.current) lineMaterial.current.opacity = 1
  })

  return (
    <group>
      <instancedMesh ref={nodes} args={[undefined, undefined, world.nodes.length]}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <lineSegments geometry={lines}>
        <lineBasicMaterial
          ref={lineMaterial}
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <instancedMesh ref={pulses} args={[undefined, undefined, PULSES]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#c9fffb" toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

const steel = (
  <meshStandardMaterial color={STEEL} emissive="#13263f" roughness={0.55} metalness={0.35} />
)

function Substation({
  smooth,
  selectedId,
  onSelect,
}: {
  smooth: MutableRefObject<number>
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    const v = layers(smooth.current).substation
    group.current.visible = v > 0.01
    group.current.scale.setScalar(0.92 + 0.08 * v)
    group.current.position.y = (1 - v) * -1.2
  })
  return (
    <group ref={group} position={SUBSTATION_POS}>
      {/* pad */}
      <mesh position={[0, -0.1, 0.5]} receiveShadow>
        <boxGeometry args={[16, 0.2, 12]} />
        <meshStandardMaterial color="#1b3050" emissive="#0b1626" roughness={0.9} />
      </mesh>
      {/* transformer with bushings and cooling fins */}
      <mesh position={[-4, 1.5, -1.5]}>
        <boxGeometry args={[3.2, 3, 2.6]} />
        {steel}
      </mesh>
      {[-0.9, 0, 0.9].map((x) => (
        <mesh key={x} position={[-4 + x, 3.6, -1.5]}>
          <cylinderGeometry args={[0.18, 0.26, 1.1, 10]} />
          <meshStandardMaterial color="#c9d6e8" roughness={0.4} />
        </mesh>
      ))}
      {[-1.4, -0.7, 0, 0.7, 1.4].map((z) => (
        <mesh key={z} position={[-5.8, 1.5, -1.5 + z * 0.8]}>
          <boxGeometry args={[0.18, 2.4, 0.5]} />
          {steel}
        </mesh>
      ))}
      {/* control cabinet (PLC) */}
      <mesh position={[1.5, 1.1, -2.5]}>
        <boxGeometry args={[1.7, 2.2, 1.1]} />
        {steel}
      </mesh>
      {/* server rack */}
      <mesh position={[4.6, 1.2, -1]}>
        <boxGeometry args={[1.3, 2.4, 1.2]} />
        {steel}
      </mesh>
      {[0.5, 1, 1.5, 2].map((y) => (
        <mesh key={y} position={[4.6, y, -0.39]}>
          <boxGeometry args={[1.0, 0.06, 0.02]} />
          <meshBasicMaterial color={TEAL} toneMapped={false} />
        </mesh>
      ))}
      {/* feeder bay and gantry */}
      <mesh position={[-0.5, 0.7, 2.6]}>
        <boxGeometry args={[1, 1.4, 1]} />
        {steel}
      </mesh>
      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={x} position={[-0.5 + x, 1.6, 4.6]}>
          <cylinderGeometry args={[0.08, 0.1, 3.2, 8]} />
          {steel}
        </mesh>
      ))}
      <mesh position={[-0.5, 3.1, 4.6]}>
        <boxGeometry args={[5.4, 0.1, 0.1]} />
        {steel}
      </mesh>
      {/* gateway mast */}
      <mesh position={[6.2, 3, 2.8]}>
        <cylinderGeometry args={[0.1, 0.14, 6, 8]} />
        {steel}
      </mesh>
      <mesh position={[6.2, 5.8, 2.8]}>
        <boxGeometry args={[0.9, 0.5, 0.3]} />
        <meshStandardMaterial color="#8da2c0" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* backup power */}
      <mesh position={[-6.2, 0.7, 3]}>
        <boxGeometry args={[2.2, 1.4, 1.3]} />
        {steel}
      </mesh>
      <Markers smooth={smooth} selectedId={selectedId} onSelect={onSelect} />
      <Flows smooth={smooth} />
    </group>
  )
}

function Markers({
  smooth,
  selectedId,
  onSelect,
}: {
  smooth: MutableRefObject<number>
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const [hover, setHover] = useState<string | null>(null)
  const refs = useRef<Record<string, THREE.Group | null>>({})
  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hover])
  useFrame((state) => {
    const v = layers(smooth.current).markers
    SUBSTATION_ASSETS.forEach((a, i) => {
      const g = refs.current[a.id]
      if (!g) return
      const active = a.id === selectedId || a.id === hover
      const pulse = 1 + 0.12 * Math.sin(state.clock.elapsedTime * 2.2 + i)
      g.scale.setScalar(Math.max(0.0001, v * (active ? 1.35 : 1) * pulse))
      g.visible = v > 0.01
    })
  })
  return (
    <>
      {SUBSTATION_ASSETS.map((a) => (
        <group
          key={a.id}
          position={a.anchor as Vec3}
          ref={(el) => {
            refs.current[a.id] = el
          }}
        >
          <mesh
            onClick={(e) => {
              e.stopPropagation()
              onSelect(a.id === selectedId ? null : a.id)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(a.id)
            }}
            onPointerOut={() => setHover((h) => (h === a.id ? null : h))}
          >
            <octahedronGeometry args={[0.34, 0]} />
            <meshBasicMaterial
              color={a.id === selectedId ? '#ffffff' : a.exposure === 'external' ? AMBER : TEAL}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 0.62, 32]} />
            <meshBasicMaterial
              color={TEAL}
              transparent
              opacity={0.6}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </>
  )
}

function Flows({ smooth }: { smooth: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const pulses = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const PER = 4
  const curves = useMemo(
    () =>
      SUBSTATION_LINKS.map((l) => {
        const a = new THREE.Vector3(
          ...(SUBSTATION_ASSETS.find((x) => x.id === l.from)!.anchor as Vec3),
        )
        const b = new THREE.Vector3(
          ...(SUBSTATION_ASSETS.find((x) => x.id === l.to)!.anchor as Vec3),
        )
        const mid = a.clone().add(b).multiplyScalar(0.5)
        mid.y += 1.3
        return new THREE.QuadraticBezierCurve3(a, mid, b)
      }),
    [],
  )
  const geometries = useMemo(
    () =>
      curves.map((c) => {
        // lineSegments draws point pairs, so a polyline needs each interior point twice.
        const pts = c.getPoints(28)
        const pairs = pts.slice(0, -1).flatMap((p, i) => [p, pts[i + 1]])
        return new THREE.BufferGeometry().setFromPoints(pairs)
      }),
    [curves],
  )
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])
  const materials = useRef<(THREE.LineBasicMaterial | null)[]>([])
  const pulseColors = useMemo(() => {
    const data = new THREE.Color(TEAL)
    const op = new THREE.Color(AMBER)
    return SUBSTATION_LINKS.flatMap((l) => Array(PER).fill(l.kind === 'data' ? data : op))
  }, [])
  useEffect(() => {
    const mesh = pulses.current
    if (!mesh) return
    pulseColors.forEach((c, i) => mesh.setColorAt(i, c))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [pulseColors])

  useFrame((state) => {
    const v = layers(smooth.current).flows
    if (group.current) group.current.visible = v > 0.01
    materials.current.forEach((m) => m && (m.opacity = 0.55 * v))
    const mesh = pulses.current
    if (!mesh || v <= 0.01) return
    const t = state.clock.elapsedTime
    curves.forEach((curve, ci) => {
      const speed = SUBSTATION_LINKS[ci].kind === 'data' ? 0.28 : 0.16
      for (let k = 0; k < PER; k++) {
        const f = (t * speed + k / PER + ci * 0.13) % 1
        dummy.position.copy(curve.getPoint(f))
        dummy.scale.setScalar(Math.max(0.0001, 0.13 * v))
        dummy.updateMatrix()
        mesh.setMatrixAt(ci * PER + k, dummy.matrix)
      }
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={group}>
      {geometries.map((g, i) => (
        <lineSegments key={i} geometry={g}>
          <lineBasicMaterial
            ref={(m) => {
              materials.current[i] = m
            }}
            color={SUBSTATION_LINKS[i].kind === 'data' ? TEAL : AMBER}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </lineSegments>
      ))}
      <instancedMesh ref={pulses} args={[undefined, undefined, curves.length * PER]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
