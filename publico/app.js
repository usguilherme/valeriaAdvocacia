import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, onValue, push, set, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Configuração do projeto (a mesma enviada).
const firebaseConfig = {
  apiKey: "AIzaSyAqzqTAETcMbj8RFvshrxRIbURydsxuXew",
  authDomain: "valeriaadvocacia-ed40f.firebaseapp.com",
  databaseURL: "https://valeriaadvocacia-ed40f-default-rtdb.firebaseio.com",
  projectId: "valeriaadvocacia-ed40f",
  storageBucket: "valeriaadvocacia-ed40f.firebasestorage.app",
  messagingSenderId: "62447520960",
  appId: "1:62447520960:web:8ddd50ba225721f2d67125"
};

// Limites das fotos (ficam dentro do Realtime Database)
const FOTO_MAX_LADO = 1000;     // pixels no maior lado
const FOTO_QUALIDADE = 0.7;     // JPEG
const FOTOS_POR_PROCESSO = 10;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const ROTULOS = { andamento: "Em andamento", aguardando: "Aguardando", concluido: "Concluído" };
const CLASSES = { andamento: "b-andamento", aguardando: "b-aguardando", concluido: "b-concluido" };

let usuario = null;
let processos = [];
let filtro = "todos";
let editandoId = null;
let rascunho = { andamentos: [], fotos: [], novasFotos: [] };
let pararLeitura = null;

// ---------- utilidades ----------
const $ = (id) => document.getElementById(id);
const hoje = () => new Date().toISOString().slice(0, 10);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const formatarData = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const diasAte = (iso) => Math.round((new Date(iso + "T00:00:00") - new Date(hoje() + "T00:00:00")) / 86400000);
const lista = (obj) => (obj ? Object.values(obj) : []);

// Reduz a imagem no navegador e devolve um data URL JPEG pequeno.
function comprimirImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não consegui ler a foto."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo não é uma imagem válida."));
      img.onload = () => {
        const escala = Math.min(1, FOTO_MAX_LADO / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", FOTO_QUALIDADE));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

// ---------- login ----------
$("l-entrar").addEventListener("click", async () => {
  $("l-erro").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("l-email").value.trim(), $("l-senha").value);
  } catch (e) {
    $("l-erro").textContent = "E-mail ou senha incorretos.";
  }
});
$("l-senha").addEventListener("keydown", (e) => { if (e.key === "Enter") $("l-entrar").click(); });
$("sair").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  usuario = user;
  $("tela-login").hidden = !!user;
  $("tela-app").hidden = !user;
  if (pararLeitura) { pararLeitura(); pararLeitura = null; }
  if (user) {
    pararLeitura = onValue(ref(db, `processos/${user.uid}`), (snap) => {
      processos = Object.entries(snap.val() || {}).map(([id, p]) => ({ id, ...p }));
      renderTudo();
    });
  } else {
    processos = [];
  }
});

// ---------- lista ----------
function linhaProcesso(p) {
  let prazo = "";
  if (p.prazo && p.situacao !== "concluido") {
    const d = diasAte(p.prazo);
    const txt = d < 0 ? "Atrasado" : d === 0 ? "Hoje" : `Em ${d} dia${d > 1 ? "s" : ""}`;
    prazo = `<small class="${d <= 2 ? "prazo-alto" : ""}">${esc(p.acao || "Prazo")} · ${txt}</small>`;
  }
  return `<div class="item" data-id="${esc(p.id)}"><div><strong>${esc(p.cliente)}</strong>
    <small>${esc(p.tipo)}${p.vara ? " · " + esc(p.vara) : ""}</small>${prazo}</div>
    <span class="badge ${CLASSES[p.situacao] || ""}">${ROTULOS[p.situacao] || ""}</span></div>`;
}

function filtrados() {
  const termo = $("busca").value.trim().toLowerCase();
  return processos.filter((p) => {
    if (filtro !== "todos" && p.situacao !== filtro) return false;
    if (!termo) return true;
    return `${p.cliente} ${p.numero}`.toLowerCase().includes(termo);
  });
}

function renderTudo() {
  $("filtros").innerHTML = [["todos", "Todos"], ["andamento", "Em andamento"], ["aguardando", "Aguardando"], ["concluido", "Concluídos"]]
    .map(([v, r]) => `<button class="chip ${filtro === v ? "ativo" : ""}" data-f="${v}">${r}</button>`).join("");

  const proximas = processos
    .filter((p) => p.prazo && p.situacao !== "concluido")
    .sort((a, b) => (a.prazo < b.prazo ? -1 : 1))
    .slice(0, 5);
  $("proximas").innerHTML = proximas.length ? proximas.map(linhaProcesso).join("")
    : `<div class="vazio">Nenhum prazo pendente.</div>`;

  const itens = filtrados();
  $("lista").innerHTML = itens.length ? itens.map(linhaProcesso).join("")
    : `<div class="vazio">Nenhum processo encontrado.</div>`;
}

$("filtros").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (b) { filtro = b.dataset.f; renderTudo(); }
});
$("busca").addEventListener("input", renderTudo);
document.body.addEventListener("click", (e) => {
  const item = e.target.closest(".item");
  if (item) abrirEdicao(item.dataset.id);
});

// ---------- modal ----------
function desenharAndamentos() {
  $("andamentos").innerHTML = rascunho.andamentos.length
    ? rascunho.andamentos.map((a) => `<li>${formatarData(a.data)} · ${esc(a.texto)}</li>`).join("")
    : "<li>Nenhum andamento registrado.</li>";
}

function desenharFotos() {
  const salvas = rascunho.fotos.map((f, i) =>
    `<div class="foto"><img src="${f.data}" alt="${esc(f.nome)}"><button data-rm="s${i}">×</button></div>`);
  const novas = rascunho.novasFotos.map((f, i) =>
    `<div class="foto"><img src="${f.data}" alt="${esc(f.nome)}"><button data-rm="n${i}">×</button></div>`);
  $("fotos").innerHTML = salvas.concat(novas).join("");
}

$("fotos").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-rm]");
  if (!b) return;
  const tipo = b.dataset.rm[0];
  const idx = Number(b.dataset.rm.slice(1));
  if (tipo === "s") rascunho.fotos.splice(idx, 1);
  else rascunho.novasFotos.splice(idx, 1);
  desenharFotos();
});

$("f-fotos").addEventListener("change", async (e) => {
  const arquivos = Array.from(e.target.files);
  e.target.value = "";
  const total = rascunho.fotos.length + rascunho.novasFotos.length;
  if (total + arquivos.length > FOTOS_POR_PROCESSO) {
    alert(`Cada processo aceita até ${FOTOS_POR_PROCESSO} fotos.`);
    return;
  }
  $("status").textContent = "Preparando fotos...";
  try {
    for (const arq of arquivos) {
      const data = await comprimirImagem(arq);
      rascunho.novasFotos.push({ nome: arq.name, data });
    }
  } catch (err) {
    alert(err.message);
  }
  $("status").textContent = "";
  desenharFotos();
});

function preencher(p) {
  $("f-numero").value = p?.numero || "";
  $("f-cliente").value = p?.cliente || "";
  $("f-tipo").value = p?.tipo || "";
  $("f-vara").value = p?.vara || "";
  $("f-situacao").value = p?.situacao || "andamento";
  $("f-acao").value = p?.acao || "";
  $("f-prazo").value = p?.prazo || "";
  $("f-obs").value = p?.obs || "";
  $("f-andamento").value = "";
  $("status").textContent = "";
  rascunho = {
    andamentos: lista(p?.andamentos).sort((a, b) => (a.data < b.data ? 1 : -1)),
    fotos: lista(p?.fotos),
    novasFotos: []
  };
  desenharAndamentos();
  desenharFotos();
}

function abrirNovo() {
  editandoId = null;
  preencher(null);
  $("modal-titulo").textContent = "Novo processo";
  $("excluir").hidden = true;
  $("modal").hidden = false;
}

function abrirEdicao(id) {
  const p = processos.find((x) => x.id === id);
  if (!p) return;
  editandoId = id;
  preencher(p);
  $("modal-titulo").textContent = "Editar processo";
  $("excluir").hidden = false;
  $("modal").hidden = false;
}

function fechar() { $("modal").hidden = true; }
$("novo").addEventListener("click", abrirNovo);
$("cancelar").addEventListener("click", fechar);
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") fechar(); });

$("btn-andamento").addEventListener("click", () => {
  const texto = $("f-andamento").value.trim();
  if (!texto) return;
  rascunho.andamentos.unshift({ data: hoje(), texto });
  $("f-andamento").value = "";
  desenharAndamentos();
});

$("salvar").addEventListener("click", async () => {
  const cliente = $("f-cliente").value.trim();
  const numero = $("f-numero").value.trim();
  if (!cliente || !numero) { alert("Preencha pelo menos o número do processo e o cliente."); return; }

  const botao = $("salvar");
  botao.disabled = true;
  try {
    const fotos = rascunho.fotos.concat(rascunho.novasFotos.map((f) => ({ nome: f.nome, data: f.data })));
    const dados = {
      numero, cliente,
      tipo: $("f-tipo").value.trim(),
      vara: $("f-vara").value.trim(),
      situacao: $("f-situacao").value,
      acao: $("f-acao").value.trim(),
      prazo: $("f-prazo").value,
      obs: $("f-obs").value.trim(),
      andamentos: rascunho.andamentos,
      fotos,
    };

    if (editandoId) {
      dados.criadoEm = processos.find((x) => x.id === editandoId)?.criadoEm || new Date().toISOString();
      await set(ref(db, `processos/${usuario.uid}/${editandoId}`), dados);
    } else {
      dados.criadoEm = new Date().toISOString();
      const nova = push(ref(db, `processos/${usuario.uid}`));
      await set(nova, dados);
    }
    fechar();
  } catch (e) {
    alert("Não foi possível salvar: " + e.message);
  } finally {
    botao.disabled = false;
  }
});

$("excluir").addEventListener("click", async () => {
  if (!editandoId || !confirm("Excluir este processo e as fotos dele?")) return;
  await remove(ref(db, `processos/${usuario.uid}/${editandoId}`));
  fechar();
});
