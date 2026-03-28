import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { AdminContentService } from './admin-content.service';

@UseGuards(AuthGuard)
@Controller('admin-content')
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  @Get('courses')
  async listCourses(@Req() req: Request) {
    await this.adminContentService.assertAdmin(req.session.userId!);
    const courses = await this.adminContentService.listCourses();
    return { courses };
  }

  @Post('courses')
  async createCourse(@Req() req: Request, @Body() dto: CreateCourseDto) {
    await this.adminContentService.assertAdmin(req.session.userId!);
    return this.adminContentService.createCourse(dto);
  }

  @Patch('courses/:courseId')
  async updateCourse(
    @Req() req: Request,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    await this.adminContentService.assertAdmin(req.session.userId!);
    return this.adminContentService.updateCourse(courseId, dto);
  }

  @Delete('courses/:courseId')
  async deleteCourse(@Req() req: Request, @Param('courseId') courseId: string) {
    await this.adminContentService.assertAdmin(req.session.userId!);
    return this.adminContentService.deleteCourse(courseId);
  }

  @Post('courses/:courseId/videos')
  async createVideo(
    @Req() req: Request,
    @Param('courseId') courseId: string,
    @Body() dto: CreateVideoDto,
  ) {
    await this.adminContentService.assertAdmin(req.session.userId!);
    return this.adminContentService.createVideo(courseId, dto);
  }

  @Patch('videos/:videoId')
  async updateVideo(@Req() req: Request, @Param('videoId') videoId: string, @Body() dto: UpdateVideoDto) {
    await this.adminContentService.assertAdmin(req.session.userId!);
    return this.adminContentService.updateVideo(videoId, dto);
  }

  @Delete('videos/:videoId')
  async deleteVideo(@Req() req: Request, @Param('videoId') videoId: string) {
    await this.adminContentService.assertAdmin(req.session.userId!);
    return this.adminContentService.deleteVideo(videoId);
  }
}
