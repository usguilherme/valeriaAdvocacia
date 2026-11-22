# Processos (sistema da advogada)

## Como abrir no VS Code
1. Extraia o zip.
2. Abra a pasta no VS Code.
3. Use a extensão "Live Server" ou rode `npx http-server -p 8000` no terminal da pasta.
4. Abra `http://127.0.0.1:8000` no navegador. Não abra o `index.html` com duplo clique, porque o Firebase precisa de servidor.

## Configuração no console do Firebase (projeto valeriaadvocacia-ed40f)
1. **Authentication → Sign-in method:** ative "E-mail/senha".
2. **Authentication → Users:** crie o usuário da advogada (e-mail e senha).
3. **Realtime Database → Regras:** cole o conteúdo de `database.rules.json` e publique.

Sem as regras publicadas, o sistema não salva ou qualquer pessoa com o link pode ler os dados. Não deixe o projeto com regras abertas.

Não é preciso o Storage nem o plano Blaze: as fotos ficam no próprio Realtime Database, reduzidas e comprimidas no navegador (máximo de 10 por processo).

## Antes de usar com processos reais
- Teste com 2 ou 3 processos fictícios.
- Confirme que a advogada entra, cadastra, anexa foto e exclui.
- Confirme que outra conta não vê os dados dela.
- Guarde a senha em um gerenciador de senhas.

## Observações
- O sistema não consulta os tribunais. Os dados são digitados pela advogada.
- Os prazos são avisos internos. A responsabilidade pelos prazos processuais continua com a advogada, e vale conferir no sistema oficial do tribunal.
- Fotos são comprimidas para caber no banco. Documentos escaneados em alta resolução perdem nitidez; para isso o ideal seria um serviço de armazenamento de arquivos.
- Os dados do banco são sensíveis (sigilo profissional e LGPD). Não compartilhe o link nem as credenciais.
