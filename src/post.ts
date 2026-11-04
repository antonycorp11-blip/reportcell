import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Correção de cor estilizada + vinheta + tinta de perigo. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uNight: { value: 0 }, uDanger: { value: 0 }, uHurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uNight; uniform float uDanger; uniform float uHurt; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 1.18 - uNight * 0.08);            // saturação
      col = (col - 0.5) * (1.07 + uNight * 0.05) + 0.5;           // contraste
      col *= mix(vec3(1.03, 1.0, 0.95), vec3(0.88, 0.95, 1.12), uNight); // dia quente / noite fria
      col = mix(col, col * vec3(1.25, 0.7, 0.6), uDanger * 0.35); // a noite está chegando
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.25, length(d * vec2(1.25, 1.0)));
      col *= mix(0.72 - uNight * 0.1, 1.0, v);
      col = mix(col, vec3(0.75, 0.05, 0.05), uHurt * (1.0 - v) * 0.8);
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
};

export class Post {
  composer: EffectComposer;
  grade: ShaderPass;
  bloom: UnrealBloomPass;
  private vm: RenderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, vmScene: THREE.Scene, camera: THREE.Camera, high: boolean) {
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.vm = new RenderPass(vmScene, camera);
    this.vm.clear = false;
    this.vm.clearDepth = true;
    this.composer.addPass(this.vm);
    const k = high ? 1 : 0.5;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x * k, size.y * k), 0.55, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setVM(on: boolean) { this.vm.enabled = on; }

  setSize(w: number, h: number) { this.composer.setSize(w, h); }

  render(night: number, danger: number, hurt: number) {
    this.grade.uniforms.uNight.value = night;
    this.grade.uniforms.uDanger.value = danger;
    this.grade.uniforms.uHurt.value = hurt;
    this.bloom.strength = 0.45 + night * 0.35;
    this.composer.render();
  }
}
