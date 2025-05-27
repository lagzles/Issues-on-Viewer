# Issues-on-Viewer
# Forge Viewer Extension – Apontamentos Visualizer

Este projeto é uma extensão personalizada para o **Autodesk Forge Viewer**. Ela conecta dados externos ao visualizador, realizando uma requisição HTTP para buscar **apontamentos** e renderizando essas informações como formas geométricas sobre o modelo 3D, além de exibir uma lista lateral para navegação rápida.

---

## Funcionalidades

Realiza requisição para uma URL backend e busca um array de apontamentos  
Desenha formas geométricas no modelo, representando cada apontamento  
Exibe um painel lateral com a lista completa dos apontamentos  
Permite interação entre o painel e os elementos no modelo (ex.: clicar no painel destaca a forma no viewer)

---

## Tecnologias Utilizadas

- **Node.js** (servidor backend)  
- **Express.js** (servidor web)  
- **Autodesk Forge Viewer** (visualização 3D)  
- **THREE.js** (para criar geometrias customizadas)  
- HTML, CSS, JavaScript

---

## Estrutura do Projeto

```
/apontamentos-extension
├── services/
│   └── aps.js
│
├── routes/
│   ├── auth.js                 # Contém o container do Forge Viewer
│   └── models.js
│
├── wwwroot/
│   ├── index.html              # Contém o container do Forge Viewer
│   ├── main.js                 
│   ├── main.css
│   └── viewer.js
│
├── server.js                   # Servidor Node.js para servir arquivos e endpoint de apontamentos
├── package.json                # Configuração de dependências e scripts
├── .env                        # Variáveis de ambiente (Forge credentials)
└── README.md                   # Este arquivo
```

---

## Como rodar localmente

1️⃣ **Clone o repositório**  
```bash
git clone https://github.com/seu-usuario/apontamentos-extension.git
cd apontamentos-extension
```

2️⃣ **Instale as dependências**  
```bash
npm install
```

3️⃣ **Configure as variáveis de ambiente**  
Crie um arquivo `.env` na raiz com:  
```
FORGE_CLIENT_ID=seu_client_id
FORGE_CLIENT_SECRET=seu_client_secret
```

4️⃣ **Inicie o servidor**  
```bash
npm start
```

O servidor estará disponível em: [http://localhost:3000](http://localhost:3000)

---

## Fluxo de funcionamento

1. O **Forge Viewer** carrega um modelo 3D (definido no `index.html`).
2. A extensão (`ApontamentosExtension.js`) faz uma chamada `fetch()` para a URL `/api/apontamentos`.
3. O backend retorna um array como:
   ```json
   [
     { "id": 1, "nome": "Pilar A", "coordenadas": [12, 8, 3] },
     { "id": 2, "nome": "Viga B", "coordenadas": [15, 10, 5] }
   ]
   ```
4. A extensão desenha no modelo cada item como uma forma geométrica.
5. O painel lateral mostra a lista dos apontamentos, permitindo interação.

---

## 📌 Exemplo visual esperado

- Esferas, cubos ou cilindros flutuando nos pontos 3D fornecidos.  
- Um painel na lateral com os nomes e IDs.  
- Ao clicar num item no painel, o modelo centraliza ou destaca a forma correspondente.

---

## 🚀 Futuras melhorias

- Permitir adicionar novos apontamentos via interface.  
- Implementar edição e remoção de apontamentos.  
- Personalizar cores ou formas dependendo do tipo de apontamento.  
- Adicionar animações ou efeitos visuais ao destacar elementos.

---

## 🤝 Contribuição

Quer colaborar?  
Abra um issue ou envie um pull request!

---

## 📜 Licença

Este projeto é livre para uso e adaptação.  
**[MIT License](LICENSE)**

