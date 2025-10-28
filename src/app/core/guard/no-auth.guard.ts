import { Injectable } from "@angular/core";
import { CanActivate, Router, UrlTree } from "@angular/router";
import { ApiService } from "../services/api.service";
import { PageLoadingService } from "../services/page-loading.service";

@Injectable({ providedIn: "root" })
export class NoAuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private api: ApiService,
    private pageLoading: PageLoadingService
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const u = this.api.usuarioAutenticado;
    if (u) {
      return this.router.parseUrl("/view/categoria");
    }

    await this.api.ensureUserReady();
    return this.api.usuarioAutenticado
      ? this.router.parseUrl("/view/categoria")
      : true;
  }
}
