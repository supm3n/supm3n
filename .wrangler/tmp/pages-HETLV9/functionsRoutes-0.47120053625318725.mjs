import { onRequest as __api_financials__ticker__js_onRequest } from "E:\\Supm3n\\functions\\api\\financials\\[ticker].js"
import { onRequest as __api_price__symbol__js_onRequest } from "E:\\Supm3n\\functions\\api\\price\\[symbol].js"

export const routes = [
    {
      routePath: "/api/financials/:ticker",
      mountPath: "/api/financials",
      method: "",
      middlewares: [],
      modules: [__api_financials__ticker__js_onRequest],
    },
  {
      routePath: "/api/price/:symbol",
      mountPath: "/api/price",
      method: "",
      middlewares: [],
      modules: [__api_price__symbol__js_onRequest],
    },
  ]