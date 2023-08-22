import {Shader} from "../Shader.js";
import {Renderer} from "../Renderer.js";
import {Camera} from "../Camera.js";
import {initVAO, initTexture} from "../init-buffers.js";

import {mat3, mat4, vec3} from "gl-matrix";

import vsSource from './shaders/mat1/v.vert?raw';
import fsSource from './shaders/mat1/f.frag?raw';

import skyVsSource from './shaders/skybox_grad/skybox_grad.vert?raw';
import skyFsSource from './shaders/skybox_grad/skybox_grad.frag?raw';

import updateVsSource from './shaders/update/update.vert?raw';
import updateFsSource from './shaders/update/update.frag?raw';

class WebGLRenderer extends Renderer {

    //---------------------------------------
    constructor(){
        // make canvas / define callbacks.
        super();

        // set up gl
        this.gl = this.canvas.getContext("webgl2");
          
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // setup shaders
        this.shader = new Shader(this.gl, vsSource, fsSource);
        this.skyShader = new Shader(this.gl, skyVsSource, skyFsSource);
        // shader for update position
        this.updateShader = new Shader(this.gl, updateVsSource, updateFsSource, ['newPos']);

        // setup datas
        this.vao = initVAO(this.gl);
        this.texture = initTexture(this.gl, {
            checker_gray : "src\\images\\checker2k.png",
            checker_colored : "src\\images\\checker2kC.png"
        });
        
        // setup camera
        this.camera = new Camera(5, 4, 7, 0, 1, 0, 0, 0, 45);
        this.camera.lookAt(0, 0, 0);
    }

    //---------------------------------------
    init(){

        let gl = this.gl;
        this.particleNum = 1000;

        let r = 10;
        const positions = new Float32Array(new Array(this.particleNum).fill(0).map(_=>this.randomInsideSphere(r)).flat());
        const velocities = new Float32Array(new Array(this.particleNum).fill(0).map(_=>this.randomInsideSphere(2)).flat());

        this.position1Buffer = this.createBuffer(gl, positions, gl.DYNAMIC_DRAW);
        this.position2Buffer = this.createBuffer(gl, positions, gl.DYNAMIC_DRAW);
        this.velocityBuffer = this.createBuffer(gl, velocities, gl.STATIC_DRAW);

        //-----------------
        this.updatePositionPrgLocs = {
            pos: gl.getAttribLocation(this.updateShader, 'pos'),
            vel: gl.getAttribLocation(this.updateShader, 'vel'),
            deltaTime: gl.getAttribLocation(this.updateShader, 'deltaTime')
        }
        // TODO: draw用のパーティクルについて上と同様のことを行う．
        // this.drawParticlePrgLocs = {
        //     pos: gl.getAttribLocation(this.updateShader, 'pos'),
        //     vel: gl.getAttribLocation(this.updateShader, 'vel'),
        //     deltaTime: gl.getAttribLocation(this.updateShader, 'deltaTime')
        // }

        //-----------------
        this.updatePositionVAO1 = this.createVertexArray(gl, [
            [this.updatePositionPrgLocs,pos, this.position1Buffer], 
            [this.updatePositionPrgLocs.vel, this.velocityBuffer]
        ]);
        this.updatePositionVAO2 = this.createVertexArray(gl, [
            [this.updatePositionPrgLocs.pos, this.position2Buffer], 
            [this.updatePositionPrgLocs.vel, this.velocityBuffer],
        ]);
        // TODO: 同上

        //-----------------
        tf1 = this.createTransformFeedback(gl, this.position1Buffer);
        tf2 = this.createTransformFeedback(gl, this.position2Buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

    }

    createTransformFeedback(gl, buffer){
        const tf = gl.createTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer);
        return tf;
    }

    createBuffer(gl, sizeOrData, usage){
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, sizeOrData, usage);
    }

    createVertexArray(gl, nameBufferPair){
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        for(const [name, buffer] of nameBufferPair){
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(name);
            gl.vertexAttribPointer(name, 3, gl.FLOAT, false, 0, 0);
        }
        return vao;
    }

    randomInsideSphere(r){
        let result = vec3.create();
        vec3.random(result, Math.random()*r);
        return [result[0], result[1], result[2]];
    }

    //---------------------------------------
    OnResize(width, height){
        this.width = width;
        this.height = height;
    }

    //---------------------------------------
    // Main loop function.
    OnFrame(timestamp, timeDelta){

        super.OnFrame();

        let gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const view = this.camera.getViewMatrix();
        const proj = mat4.create();
        mat4.perspective(proj, this.camera.fov * Math.PI / 180.0, this.width/this.height, 0.1, 100.0);

        this.shader.use();
        this.shader.setMat4("proj", proj);
        this.shader.setMat4("view", view);
        this.skyShader.use();
        this.skyShader.setMat4("proj", proj);
        let viewTrans = mat4.fromValues(
            view[0], view[1], view[2], 0,
            view[4], view[5], view[6], 0,
            view[8], view[9], view[10], 0,
            0, 0, 0, 1
        );
        this.skyShader.setMat4("view", viewTrans);

        // render scene
        gl.viewport(0, 0, this.width, this.height);
        gl.depthMask(true);
        this.drawScene(this.shader);

        //render background
        gl.viewport(0, 0, this.width, this.height);
        gl.depthMask(false);
        this.skyShader.use();
        this.renderCube();
    }

    // draw geometries with given shader
    drawScene(shader){
        let gl = this.gl;
        let model = mat4.create();
        shader.use();
        
        model = mat4.create();
        mat4.translate(model, model, vec3.fromValues(0, 0, 0));
        mat4.rotate(model, model, 0, vec3.fromValues(0, 1, 0));
        shader.setMat4("model", model);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture.checker_gray);
        this.renderCube();

        model = mat4.create();
        mat4.translate(model, model, vec3.fromValues(1.8, -0.6, 0.6));
        mat4.scale(model, model, vec3.fromValues(0.4, 0.4, 0.4));
        shader.setMat4("model", model);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture.checker_gray);
        this.renderCube();

        model = mat4.create();
        mat4.translate(model, model, vec3.fromValues(0, -1.0, 0));
        mat4.scale(model, model, vec3.fromValues(5, 5, 5));
        shader.setMat4("model", model);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture.checker_colored);
        this.renderPlane();
    }

    renderCube(){
        let gl = this.gl;
        gl.bindVertexArray(this.vao.cube);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    }

    renderPlane(){
        let gl = this.gl;
        gl.bindVertexArray(this.vao.plane);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

export {WebGLRenderer}