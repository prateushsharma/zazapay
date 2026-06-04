import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import * as THREE from 'three'
import './AgentGraph.css'

interface NodeDef {
  id: string
  label: string
  position: [number, number, number]
  color: string
  active?: boolean
}

interface EdgeDef {
  from: [number, number, number]
  to: [number, number, number]
  active?: boolean
}

const NODES: NodeDef[] = [
  { id: 'planner',     label: 'PlannerGateway',     position: [-3,  1.5, 0], color: '#7c3aed' },
  { id: 'negotiation', label: 'NegotiationGateway', position: [ 0,  1.5, 0], color: '#f59e0b' },
  { id: 'executor-a',  label: 'ExecutorAgent A',    position: [ 2.5, -0.5, 1], color: '#00fff0' },
  { id: 'executor-b',  label: 'ExecutorAgent B',    position: [ 2.5, -0.5, -1], color: '#00fff0' },
  { id: 'verifier',    label: 'VerifierGateway',    position: [ 3,  1.5, 0], color: '#00ff88' },
  { id: 'pir',         label: 'PaymentIntentReg',   position: [-3, -1.5, 0], color: '#3b82f6' },
  { id: 'receipt',     label: 'ReceiptRegistry',    position: [ 3, -1.5, 0], color: '#3b82f6' },
]

const EDGES: EdgeDef[] = [
  { from: [-3, -1.5, 0], to: [-3,  1.5, 0] },
  { from: [-3,  1.5, 0], to: [ 0,  1.5, 0] },
  { from: [ 0,  1.5, 0], to: [ 2.5, -0.5,  1] },
  { from: [ 0,  1.5, 0], to: [ 2.5, -0.5, -1] },
  { from: [ 2.5, -0.5,  1], to: [ 3,  1.5, 0] },
  { from: [ 2.5, -0.5, -1], to: [ 3,  1.5, 0] },
  { from: [ 3,  1.5, 0], to: [ 3, -1.5, 0] },
]

function PulsingNode({ node }: { node: NodeDef }) {
  const meshRef  = useRef<THREE.Mesh>(null)
  const glowRef  = useRef<THREE.Mesh>(null)
  const offset   = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (meshRef.current) {
      meshRef.current.position.y = node.position[1] + Math.sin(t * 0.8 + offset) * 0.08
    }
    if (glowRef.current) {
      const s = 1 + Math.sin(t * 1.5 + offset) * 0.15
      glowRef.current.scale.setScalar(s)
      ;(glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.08 + Math.sin(t * 1.5 + offset) * 0.04
    }
  })

  return (
    <group position={node.position}>
      {/* glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshBasicMaterial color={node.color} transparent opacity={0.1} />
      </mesh>
      {/* core sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
    </group>
  )
}

function FlowingEdge({ edge, index }: { edge: EdgeDef; index: number }) {
  const ref    = useRef<THREE.Mesh>(null)
  const offset = useMemo(() => index * 0.7, [index])

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = (clock.getElapsedTime() * 0.5 + offset) % 1
      const from = new THREE.Vector3(...edge.from)
      const to   = new THREE.Vector3(...edge.to)
      ref.current.position.lerpVectors(from, to, t)
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.4 + Math.sin(t * Math.PI) * 0.5
    }
  })

  const points = useMemo(() => [
    new THREE.Vector3(...edge.from),
    new THREE.Vector3(...edge.to),
  ], [edge])

  return (
    <>
      <Line
        points={points}
        color="rgba(124,58,237,0.25)"
        lineWidth={1}
      />
      <mesh ref={ref}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#00fff0" transparent opacity={0.8} />
      </mesh>
    </>
  )
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.1) * 0.15
    }
  })

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 5, 5]} intensity={1} color="#7c3aed" />
      <pointLight position={[0, -5, -5]} intensity={0.5} color="#00fff0" />
      {NODES.map(n => <PulsingNode key={n.id} node={n} />)}
      {EDGES.map((e, i) => <FlowingEdge key={i} edge={e} index={i} />)}
    </group>
  )
}

export default function AgentGraph() {
  return (
    <div className="agent-graph">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.4}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
      <div className="agent-graph__labels">
        {NODES.map(n => (
          <div key={n.id} className="agent-graph__label" style={{ color: n.color }}>
            <span className="agent-graph__dot" style={{ background: n.color }} />
            {n.label}
          </div>
        ))}
      </div>
    </div>
  )
}
