#version 300 es
precision mediump float;

layout(location=0) in vec3 pos;

uniform mat4 view;
uniform mat4 proj;

void main(){
    gl_Position = proj * view * vec4(pos,1);
    gl_PointSize = 10.0;
}