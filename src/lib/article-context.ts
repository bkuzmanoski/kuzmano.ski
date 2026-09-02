import { createContext, use } from "react";

/** What an article provides to the content it renders. */
export interface Article {
  route: string;
  reportCopyFailure: () => void;
}

export const ArticleContext = createContext<Article | null>(null);

export const useArticle = () => use(ArticleContext);
