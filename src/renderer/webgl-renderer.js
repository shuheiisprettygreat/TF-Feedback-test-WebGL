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

import drawVsSource from './shaders/draw/draw.vert?raw';
import drawFsSource from './shaders/draw/draw.frag?raw';

import quadVsSource from './shaders/NDCQuad/NDCQuad.vert?raw';
import quadFsSource from './shaders/NDCQuad/NDCQuad.frag?raw';

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
        // shader for drawing particles
        this.drawShader = new Shader(this.gl, drawVsSource, drawFsSource);
        // debug quad shader
        this.quadShader = new Shader(this.gl, quadVsSource, quadFsSource);

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

        // setup random position and velocity
        let r = 10;
        const positions = new Float32Array(new Array(this.particleNum).fill(0).map(_=>this.randomInsideSphere(r)).flat());
        const velocities = new Float32Array(new Array(this.particleNum).fill(0).map(_=>this.randomInsideSphere(2)).flat());

        this.position1Buffer = this.createBuffer(gl, positions, gl.DYNAMIC_DRAW);
        this.position2Buffer = this.createBuffer(gl, 12 * this.particleNum, gl.DYNAMIC_DRAW);
        this.velocityBuffer = this.createBuffer(gl, velocities, gl.STATIC_DRAW);

        //-----------------
        this.updatePositionPrgLocs = {
            pos: gl.getAttribLocation(this.updateShader.id, 'pos'),
            vel: gl.getAttribLocation(this.updateShader.id, 'vel'),
        }
        this.drawPrgLocs = {
            pos: gl.getAttribLocation(this.drawShader.id, 'pos'),
        }

        // setup VAOs -----------------
        const updatePositionVAO1 = this.createVertexArray(gl, [
            [this.updatePositionPrgLocs.pos, this.position1Buffer], 
            [this.updatePositionPrgLocs.vel, this.velocityBuffer]
        ]);
        const updatePositionVAO2 = this.createVertexArray(gl, [
            [this.updatePositionPrgLocs.pos, this.position2Buffer], 
            [this.updatePositionPrgLocs.vel, this.velocityBuffer],
        ]);
        const drawVAO1 = this.createVertexArray(gl, [
            [this.drawPrgLocs.pos, this.position1Buffer],
        ]);
        const drawVAO2 = this.createVertexArray(gl, [
            [this.drawPrgLocs.pos, this.position2Buffer],
        ]);

        // setup textures to save positions. -----------------
        this.textureWidth = Math.ceil(Math.sqrt(this.particleNum));
        this.textureHeight = Math.ceil(this.particleNum / this.textureWidth);
        let numComponent = 3;
        let textureData = new Float32Array(this.textureWidth * this.textureHeight * numComponent);
        textureData.set(positions);

        this.positionTexture1 = this.createTexture(gl, textureData, gl.RGB32F, gl.RGB, gl.FLOAT,  this.textureWidth, this.textureHeight);
        this.positionTexture2 = this.createTexture(gl, null,        gl.RGB32F, gl.RGB, gl.FLOAT, this.textureWidth, this.textureHeight);

        // create transform feedbacks -----------------
        const tf1 = this.createTransformFeedback(gl, this.position1Buffer);
        const tf2 = this.createTransformFeedback(gl, this.position2Buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
        
        this.current = {
            updateVa : updatePositionVAO1,
            tf : tf2,
            drawVa: drawVAO2
        };

        this.next = {
            updateVa : updatePositionVAO2,
            tf : tf1,
            drawVa: drawVAO1
        };

    }

    randomInsideSphere(r){
        let result = vec3.create();
        vec3.random(result, Math.random()*r);
        return [result[0], result[1], result[2]];
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
        return buf;
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

    createTexture(gl, data, internalFormat, format, type, width, height) {
        const result = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, result);
        gl.texImage2D(gl.TEXTURE_2D, 0,internalFormat, width, height, 0, format, type, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return result;
    }
    
    //---------------------------------------
    OnResize(width, height){
        this.width = width;
        this.height = height;
    }

    //---------------------------------------
    beforeFrame(timestamp, timeDelta){
        let gl = this.gl;
        this.updateShader.use();
        this.updateShader.setFloat("deltaTime", timeDelta*0.001);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindVertexArray(this.current.updateVa);
        // Fragment shader wont run
        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.current.tf);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.particleNum);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        gl.disable(gl.RASTERIZER_DISCARD);
    
    }

    //---------------------------------------
    // Main loop function.
    OnFrame(timestamp, timeDelta){

        super.OnFrame();

        let gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
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
        this.drawShader.use();
        this.drawShader.setMat4("proj", proj);
        this.drawShader.setMat4("view", view);

        // render scene
        gl.viewport(0, 0, this.width, this.height);
        this.drawShader.use();
        gl.bindVertexArray(this.current.drawVa);
        gl.drawArrays(gl.POINTS, 0, this.particleNum);

        this.drawScene(this.shader);

        //render background
        gl.viewport(0, 0, this.width, this.height);
        gl.depthMask(false);
        this.skyShader.use();
        this.renderCube();

        // swap bfufer
        const swap = this.current;
        this.current = this.next;
        this.next = swap;

        // debug quad
        let debugSize = this.width * 0.1;
        gl.viewport(0, 0, debugSize, debugSize);
        this.quadShader.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.positionTexture1);
        this.renderQuad();
    }

    // draw geometries with given shader
    drawScene(shader){
        let gl = this.gl;
        let model = mat4.create();
        shader.use();

        model = mat4.create();
        mat4.translate(model, model, vec3.fromValues(0, -1.0, 0));
        mat4.scale(model, model, vec3.fromValues(5, 5, 5));
        shader.setMat4("model", model);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture.checker_gray);
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

    renderQuad(){
        let gl = this.gl;
        gl.bindVertexArray(this.vao.quad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

export {WebGLRenderer}