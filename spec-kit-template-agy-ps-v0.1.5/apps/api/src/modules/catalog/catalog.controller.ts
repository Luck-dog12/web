import { Controller, Get, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('courses')
  async listCourses() {
    const courses = await this.catalogService.listCourses();
    return { courses };
  }

  @Get('courses/:courseId')
  async getCourse(@Param('courseId') courseId: string) {
    const course = await this.catalogService.getCourse(courseId);
    return { course };
  }
}
