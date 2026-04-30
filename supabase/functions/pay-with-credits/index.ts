// deno-lint-ignore-file
// ⚠️ DEPRECATED — отключено намеренно.
//
// Раньше эта функция реализовывала старую "пакетную" модель:
//   1) создавала order со статусом generation_status="running"
//   2) списывала photosCount (5/15/50) кредитов одним debit'ом
//   3) дергала generate-photo с photosCount → автогенерация всего пакета
//
// Это противоречит новой модели "кошелёк": пользователь покупает БАЛАНС
// генераций, а тратит их по одной через generate-one (списание -1 за фото).
//
// Любой вызов этого эндпоинта теперь возвращает 410 Gone и НИЧЕГО не делает:
// - не списывает кредиты
// - не создаёт orders
// - не дёргает generate-photo
//
// Не удаляем файл физически, чтобы при случайном вызове со старого фронта
// или из тестов получить понятную ошибку, а не 404 / молчаливый сбой.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.warn("[pay-with-credits] DEPRECATED endpoint called — returning 410 Gone");

  return new Response(
    JSON.stringify({
      error: "This endpoint is deprecated. Use generate-one.",
      deprecated: true,
      replacement: "generate-one",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
