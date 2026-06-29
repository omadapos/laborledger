import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class AppController {
  @Get()
  getHealth() {
    return {
      service: "api",
      status: "ok"
    };
  }
}
