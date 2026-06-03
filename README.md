# Auto Mais — Sistema de Gestão de Veículos

Sistema web para gerenciamento de veículos, clientes, contratos e vendas.

## Tecnologias
- HTML5 / CSS3 / JavaScript puro (sem frameworks)
- Firebase Firestore (banco de dados em nuvem)
- Login local com sessão via sessionStorage

## Arquivos

| Arquivo | Descrição |
|---|---|
| `login.html` | Tela de acesso ao sistema |
| `index.html` | Painel geral (dashboard) |
| `veiculos.html` | Cadastro de veículos + Placa de Venda |
| `vendas.html` | Registro de vendas + Contrato + Checklist |
| `contratos.html` | Contratos (Compra/Venda, Consignação, Compra) |
| `cadastros.html` | Clientes e Fornecedores |
| `gestao.html` | Manutenção, Relatórios e Usuários |
| `firebase-shared.js` | Configuração Firebase + funções compartilhadas |

## Como usar

1. Faça o deploy no **Firebase Hosting** ou qualquer servidor HTTP
2. Configure as **Regras do Firestore** (ver abaixo)
3. Acesse `login.html` e entre com suas credenciais

## Regras do Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Empresa
AUTO MAIS COMERCIO E CORRETORA DE VEÍCULOS LTDA  
CNPJ: 05.622.137/0001-00  
Rua Juarez Távora, 346 - São João - Feira de Santana/BA  
Tel: (75) 3225-2932 / 98135-5322  
atendimento@automaiscar.com.br
