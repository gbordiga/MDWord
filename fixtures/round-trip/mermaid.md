# Processo

```mermaid
flowchart TB
  Cliente([Cliente]) -->|Richieste| Commerciale[IPR002 Commerciale]
  Commerciale -->|Cartellino| Produzione[IPR004 Produzione]
  Produzione -->|Prodotto conforme| Cliente
```
