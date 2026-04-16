import { router } from "../server";
import { misRouter } from "./mis";
import { uploadsRouter } from "./uploads";

export const appRouter = router({
  mis: misRouter,
  uploads: uploadsRouter,
});

export type AppRouter = typeof appRouter;
