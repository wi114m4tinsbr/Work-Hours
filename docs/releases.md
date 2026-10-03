# Publicação e alinhamento das versões

Regra solicitada pelo dono em 03/10/2026.

- Oficial: https://shifthours.com/ — branch main.
- Teste: https://work-hours-git-feature-free-plan-9d3e73-wi114m4tinsbrs-projects.vercel.app/ — branch feature/free-plan-job-limit.
- Preservar essa branch e esse link de teste.

## A cada publicação autorizada

1. Conferir trabalho local e mudanças remotas, sem sobrescrever alterações em andamento.
2. Aplicar e validar as mudanças na branch de teste. Os checks incluem lint, PDF, Fórmula Fácil, quotas, Telegram, inicialização da API, build e interface.
3. Publicar no oficial somente depois da validação adequada à mudança.
4. Conferir igualdade dos arquivos por git diff entre os dois refs remotos. Commits de merge podem ter SHAs diferentes com arquivos idênticos; isso é normal.
5. Correções feitas primeiro no oficial devem retornar à branch de teste. Não redefinir nem forçar branches com mudanças ainda não revisadas.
6. Confirmar os deployments Vercel de ambas as versões; não confundir push no GitHub com deploy concluído. Conferir os dois endereços quando acessíveis.
7. Atualizar relatório e contexto do projeto. Registrar pendências e não anunciar validações que não foram feitas.

Os checks automáticos são executados em pushes nas duas branches. Isso não implementa sincronização automática entre branches: o responsável pela publicação deve verificar e concluir o alinhamento.

## Diferenças intencionais

Mesmo código não significa mesmas credenciais ou efeitos externos. Telegram opera somente em Production para não trocar o webhook nem gerar alertas do ambiente de teste. Preview compartilha dados do suporte, mas não envia notificações. Segredos ficam nos serviços que os utilizam; não copiar para GitHub nem para o navegador.
