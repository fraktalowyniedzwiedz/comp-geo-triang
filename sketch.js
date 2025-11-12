/* eslint-disable no-undef, no-unused-vars */
////////////////////////////////////////
// 3-colour wire-frame  (figure-1b cylinder)
////////////////////////////////////////

class Vertex {
  constructor(u, v) {
    this.u = u;
    this.v = v;
    this.color = null;
  }
}
class Edge {
  constructor(v1, v2) {
    this.v1 = v1;
    this.v2 = v2;
    this.wings = [];
  }
}
class Face {
  constructor(vCycle) {
    this.verts = vCycle;
  } // Vertex objects
}

var triangulated = false;

////////////////////////////////////////
// CYLINDER  S¹ × [0,1]
////////////////////////////////////////
class TriangulationHandler {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.vertices = [];
    this.edges = [];
    this.faces = [];
    this.front_vertices = [];
    this.front_edges = [];

    this.facesPrime = []; // M′
    this.facesTPrime = []; // T′
    this.edgesPrime = [];
    this.edgesTPrime = [];
    this.verticesPrime = [];
    this.verticesTPrime = [];

    this.build();
  }

  build() {
    const cols = this.cols,
      rows = this.rows;

    // 1️⃣ vertices
    for (let i = 0; i <= rows; i++)
      for (let j = 0; j < cols; j++)
        this.vertices.push(new Vertex(j / cols, i / rows));

    // 2️⃣ edges
    let edgeIndex = 0;
    // horizontal (wrap)
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= cols; j++) {
        const a = this.vertices[i * cols + j];
        const b = this.vertices[i * cols + ((j + 1) % cols)];
        this.edges.push(new Edge(a, b));
      }
    }
    // vertical
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= cols; j++) {
        const a = this.vertices[i * cols + j];
        const b = this.vertices[(i + 1) * cols + j];
        this.edges.push(new Edge(a, b));
      }
    }

    // 3️⃣ faces  (quads)
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const jp = (j + 1) % cols;
        const vA = this.vertices[i * cols + j],
          vB = this.vertices[i * cols + jp],
          vC = this.vertices[(i + 1) * cols + jp],
          vD = this.vertices[(i + 1) * cols + j];

        const face = new Face([vA, vB, vC, vD]);
        this.faces.push(face);
        // wings
        [
          [vA, vB],
          [vB, vC],
          [vC, vD],
          [vD, vA],
        ].forEach(([va, vb]) =>
          this.findEdge(va, vb).wings.push(this.faces.length - 1)
        );
      }
    }
  }

  findEdge(va, vb) {
    for (const e of this.edges)
      if ((e.v1 === va && e.v2 === vb) || (e.v1 === vb && e.v2 === va))
        return e;
    return null;
  }

  /* ---------- paper §3.4  (mini) ---------- */
  colorize(m) {
    let counts = [0, 0, 0];
    const faceIndex = this.faces.indexOf(m);

    // 1️⃣ All edges incident to this face
    const incidentEdges = this.edges.filter((e) => e.wings.includes(faceIndex));

    // 2️⃣ Among those, find edges NOT in the front
    const notInFrontEdges = incidentEdges.filter(
      (e) => !this.front_edges.includes(e)
    );

    // 3️⃣ From these, we’ll check if both vertices are in the front
    const candidateEdges = notInFrontEdges.filter((e) => {
      const uInFront = this.front_vertices.includes(e.v1);
      const vInFront = this.front_vertices.includes(e.v2);
      return uInFront && vInFront;
    });
    let i = 0;
    let j = 0;
    while (i < 3 && j < m.verts.length) {
      if (m.verts[j].color == null) {
        m.verts[j].color = i;
        counts[i]++;

        i++;
      }
      j++;
    }

    // 3️⃣ Finally, color any remaining uncolored vertices so that adjacent vertices differ
    j = 0;
    while (j < m.verts.length) {
      const v = m.verts[j];
      if (v.color == null) {
        // Get previous and next vertices in this face (wrap around the boundary)
        const prev = m.verts[(j - 1 + m.verts.length) % m.verts.length];
        const next = m.verts[(j + 1) % m.verts.length];

        // Gather their colors (ignore nulls)
        const neighborColors = new Set();
        if (prev.color != null) neighborColors.add(prev.color);
        if (next.color != null) neighborColors.add(next.color);

        // Pick the first available color from {0,1,2} not used by neighbors
        const possibleColors = [0, 1, 2];
        const chosen = possibleColors.find((c) => !neighborColors.has(c));

        // Assign and update the counts
        v.color = chosen;
        counts[chosen]++;
      }
      j++;
    }

    /*console.log("incidentEdges:", incidentEdges);
    console.log("not in front edges:", notInFrontEdges);
    console.log("candidates (both verts in front):", candidateEdges);

    console.log("incidentEdges:", incidentEdges); */
  }

  split(m) {
    // Color counts
    const counts = [0, 0, 0];
    m.verts.forEach((v) => {
      if (v.color != null) counts[v.color]++;
    });

    const uniqueColorIndex = counts.findIndex((c) => c === 1);
    if (uniqueColorIndex === -1) {
      console.warn("Step 3 not applicable — no color with count == 1");
      return [];
    }

    const u = m.verts.find((v) => v.color === uniqueColorIndex);
    const others = m.verts.filter((v) => v !== u);

    const S = [];
    for (let i = 0; i < others.length - 1; i++) {
      S.push(new Face([u, others[i], others[i + 1]]));
    }

    console.log(
      "Split produced",
      S.length,
      "triangles from face with",
      m.verts.length,
      "vertices."
    );
    return S;
  }

  process(m) {
    this.colorize(m);

    const S = this.split(m); // new triangles
    //this.facesTPrime.push(...S); // T′ ← T′ ∪ S
    //this.facesPrime = this.facesPrime.filter((f) => f !== m); // M′ ← M′ − m
    //this.facesTPrime.push(...S); // Add to triangulated structure
    this.facesPrime = this.facesPrime.filter((f) => f !== m); // Remove m from M′
    //this.facesPrime = this.facesPrime.filter(f => f !== m);
    //this.facesTPrime = this.facesTPrime.filter(f => f !== m);

    // Add new triangles to both
    this.facesPrime.push(...S);
    this.facesTPrime.push(...S);

    this.updateFront();
    console.log("wat", S);
    console.log("ook", this.front_edges);
    console.log(this.front_vertices);
  }

  updateFront() {
    // Edge usage in triangulated patch T′
    console.log("updatefront ", this.edgesPrime);
    console.log("Tprime", this.edgesTPrime);
  }

  triangulate() {
    const vmap = new Map();
    //building M' from deepcopy of vertices map and faces for
    this.verticesPrime = this.vertices.map((v) => {
      const vNew = new Vertex(v.u, v.v);
      vNew.color = v.color;
      vmap.set(v, vNew);
      return vNew;
    });
    //console.log("VerticesPrime:", this.verticesPrime);

    this.edgesPrime = this.edges.map((e) => {
      const v1New = vmap.get(e.v1);
      const v2New = vmap.get(e.v2);
      const eNew = new Edge(v1New, v2New);
      eNew.wings = [...e.wings]; // copy numeric indices or shallow data
      return eNew;
    });
    //console.log("EdgesPrime:", this.edgesPrime);
    //console.log("edges:", this.edges);

    this.facesPrime = this.faces.map((f) => {
      const vertsNew = f.verts.map((v) => vmap.get(v));
      const fNew = new Face(vertsNew);
      return fNew;
    });
    //console.log("FacesPrime:", this.facesPrime);

    topo.process(this.facesPrime[0]);

    while (this.verticesPrime > 2) {}
  }
  /* ---------- draw original quads ---------- */
  draw(xOffset, yOffset, gridW = 800, gridH = 400) {
    push();
    translate(xOffset, yOffset);
    stroke(0);
    noFill();

    this.faces.forEach((f) => {
      beginShape();
      f.verts.forEach((v) =>
        vertex(map(v.u, 0, 1, 0, gridW * 1.2), map(v.v, 0, 1, 0, gridH))
      );
      endShape(CLOSE);
    });

    stroke("red");
    strokeWeight(2);
    let ymid = gridH / 2;
    line(-10, ymid, 0, ymid);
    line(gridW, ymid, gridW + 10, ymid);
    noStroke();
    fill("red");
    text("u=0", -40, ymid + 5);
    text("u=1 (same points)", gridW + 15, ymid + 5);
    pop();
  }

  /* todo rename pas mprime */
  drawMPrime(xOffset, yOffset, gridW = 800, gridH = 400) {
    push();
    translate(xOffset, yOffset);
    stroke(0);
    noFill();
    /*this.faces.forEach((f) => {
      // 6 quads
      beginShape();
      f.verts.forEach((v) =>
        vertex(map(v.u, 0, 1, 0, gridW), map(v.v, 0, 1, 0, gridH))
      );
      endShape(CLOSE);
    });*/
    this.facesTPrime.forEach((f) => {
      beginShape();
      f.verts.forEach((v) =>
        vertex(map(v.u, 0, 1, 0, gridW * 1.2), map(v.v, 0, 1, 0, gridH))
      );
      endShape(CLOSE);
    });

    /* vertex colour digits */
    noStroke();
    fill(0, 0, 255);
    textAlign(CENTER, CENTER);
    textSize(10);
    const drawn = new Set();
    this.facesPrime.forEach((f) =>
      f.verts.forEach((v) => {
        if (drawn.has(v)) return;
        drawn.add(v);
        const x = map(v.u, 0, 1, 0, gridW * 1.2);
        const y = map(v.v, 0, 1, 0, gridH);
        text(v.color ?? "?", x, y - 4);
      })
    );
    pop();
  }
}

////////////////////////////////////////
// CONTROLS
////////////////////////////////////////
let topo;
let showColoured = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textSize(16);
  fill(0);
  topo = new TriangulationHandler(3, 2); // 3 cols × 2 rows  →  6 quads
  const btn = createButton("Triangulate");
  btn.position(30, 85);
  btn.mousePressed(() => {
    if (!showColoured) {
      topo.triangulate();
      showColoured = true;
    }
  });
}

function draw() {
  background(235);
  text("3-Coloured Triangulation  (wire-frame)", 30, 50);
  text(`Quads: ${topo.faces.length}  (3×2 = 6 expected)`, 30, 70);
  if (showColoured) topo.drawMPrime(100, 120);
  else topo.draw(100, 120);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
