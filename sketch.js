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

    // vertices
    for (let i = 0; i <= rows; i++)
      for (let j = 0; j < cols; j++)
        this.vertices.push(new Vertex(j / cols, i / rows));

    // edges
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

    // faces  (quads)
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

  colorize(m) {
    let counts = [0, 0, 0];
    const faceIndex = this.faces.indexOf(m);

    // 1 All edges incident to this face
    const incidentEdges = this.edges.filter((e) => e.wings.includes(faceIndex));

    // 2 Among those, find edges NOT in the front
    const notInFrontEdges = incidentEdges.filter(
      (e) => !this.front_edges.includes(e)
    );

    // 3 From these, we'll check if both vertices are in the front
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

    // 3 Finally, color any remaining uncolored vertices so that adjacent vertices differ
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
    this.facesPrime = this.facesPrime.filter((f) => f !== m); // Remove m from M′

    // Add new triangles to both
    this.facesPrime.push(...S);
    this.facesTPrime.push(...S);

    this.updateFront();
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

    this.edgesPrime = this.edges.map((e) => {
      const v1New = vmap.get(e.v1);
      const v2New = vmap.get(e.v2);
      const eNew = new Edge(v1New, v2New);
      eNew.wings = [...e.wings];
      return eNew;
    });

    this.facesPrime = this.faces.map((f) => {
      const vertsNew = f.verts.map((v) => vmap.get(v));
      const fNew = new Face(vertsNew);
      return fNew;
    });

    this.process(this.facesPrime[0]);

    while (this.verticesPrime > 2) {}
  }

  /* ---------- draw original quads ---------- */
  draw(xOffset, yOffset, gridW, gridH) {
    push();
    translate(xOffset, yOffset);
    stroke(0);
    strokeWeight(1.5);
    noFill();

    this.faces.forEach((f) => {
      beginShape();
      f.verts.forEach((v) =>
        vertex(map(v.u, 0, 1, 0, gridW), map(v.v, 0, 1, 0, gridH))
      );
      endShape(CLOSE);
    });

    // Draw u=0 and u=1 labels
    stroke("red");
    strokeWeight(2);
    let ymid = gridH / 2;
    line(-10, ymid, 0, ymid);
    line(gridW, ymid, gridW + 10, ymid);
    noStroke();
    fill("red");
    textSize(12);
    textAlign(CENTER, CENTER);
    text("u=0", -25, ymid);
    text("u=1", gridW + 25, ymid);
    pop();
  }

  /* draw triangulated result */
  drawMPrime(xOffset, yOffset, gridW, gridH) {
    push();
    translate(xOffset, yOffset);
    stroke(0);
    strokeWeight(1.5);
    noFill();
    
    // Draw triangulated faces
    this.facesTPrime.forEach((f) => {
      beginShape();
      f.verts.forEach((v) =>
        vertex(map(v.u, 0, 1, 0, gridW), map(v.v, 0, 1, 0, gridH))
      );
      endShape(CLOSE);
    });

    /* vertex colour digits */
    noStroke();
    fill(0, 0, 200);
    textAlign(CENTER, CENTER);
    textSize(11);
    textStyle(BOLD);
    const drawn = new Set();
    this.facesPrime.forEach((f) =>
      f.verts.forEach((v) => {
        if (drawn.has(v)) return;
        drawn.add(v);
        const x = map(v.u, 0, 1, 0, gridW);
        const y = map(v.v, 0, 1, 0, gridH);
        fill(this.getColorForValue(v.color));
        text(v.color ?? "?", x, y);
      })
    );
    pop();
  }

  getColorForValue(color) {
    const colors = [
      [255, 0, 0],    // Red for 0
      [0, 150, 0],    // Green for 1  
      [0, 0, 255]     // Blue for 2
    ];
    return color !== null && color >= 0 && color < 3 ? colors[color] : [0, 0, 0];
  }
}

////////////////////////////////////////
// CONTROLS
////////////////////////////////////////
let topo;
let showColoured = false;
let canvas;

function setup() {
  // Get the container dimensions
  const container = document.getElementById('sketch-container');
  const containerWidth = container.offsetWidth - 40; // Account for padding
  const containerHeight = 450;
  
  // Create canvas that fits the container
  canvas = createCanvas(containerWidth, containerHeight);
  canvas.parent('sketch-container');
  
  textSize(14);
  fill(0);
  topo = new TriangulationHandler(3, 2); // 3 cols × 2 rows  →  6 quads
  
  // Setup button event listener
  const triangulateBtn = document.getElementById('triangulate-btn');
  triangulateBtn.addEventListener('click', () => {
    if (!showColoured) {
      topo.triangulate();
      showColoured = true;
      triangulateBtn.disabled = true;
      triangulateBtn.textContent = 'Triangulated';
      triangulateBtn.style.background = '#27ae60';
    }
  });
}

function draw() {
  background(245);
  
  // Calculate drawing area with margins
  const margin = 50;
  const drawWidth = width - (margin * 2);
  const drawHeight = height - (margin * 2) - 30;
  const drawX = margin;
  const drawY = margin + 20;
  
  // Draw title and info
  fill(50);
  textSize(16);
  textStyle(BOLD);
  text("3-Colored Triangulation Demo", 20, 25);
  textSize(12);
  textStyle(NORMAL);
  
  let statusText = showColoured ? 
    `Triangulated: ${topo.facesTPrime.length} triangles` : 
    `Original: ${topo.faces.length} quadrilaterals`;
  text(statusText, 20, 45);
  
  // Draw the appropriate visualization
  if (showColoured) {
    topo.drawMPrime(drawX, drawY, drawWidth, drawHeight);
    // Draw legend for colors
    drawColorLegend(drawX + drawWidth - 120, drawY + drawHeight + 10);
  } else {
    topo.draw(drawX, drawY, drawWidth, drawHeight);
  }
  
  // Draw boundary info
  fill(100);
  textSize(10);
  text("Cylindrical mesh: left and right edges are identified", drawX, drawY + drawHeight + 25);
}

function drawColorLegend(x, y) {
  push();
  translate(x, y);
  textSize(10);
  textStyle(BOLD);
  text("Vertex Colors:", 0, -5);
  textStyle(NORMAL);
  
  const colors = [
    { value: 0, color: [255, 0, 0], label: "Color 0" },
    { value: 1, color: [0, 150, 0], label: "Color 1" },
    { value: 2, color: [0, 0, 255], label: "Color 2" }
  ];
  
  colors.forEach((item, i) => {
    fill(item.color);
    text(item.label, 25, i * 15);
    fill(0);
    text(item.value, 10, i * 15);
  });
  pop();
}

function windowResized() {
  // Resize canvas when window is resized
  const container = document.getElementById('sketch-container');
  const containerWidth = container.offsetWidth - 40;
  resizeCanvas(containerWidth, 450);
}
