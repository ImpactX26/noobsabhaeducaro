import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto, UpdateGoalDto } from './dto/applicant.dto';

// Ownership of `:applicantId` is enforced for every route by the global ApplicantOwnerGuard.
@ApiTags('applicants')
@ApiBearerAuth()
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicants: ApplicantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an applicant owned by the signed-in account' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApplicantDto) {
    return this.applicants.create(user.id, dto);
  }

  @Get(':applicantId')
  @ApiOperation({ summary: 'Get an applicant with a compact document list' })
  get(@Param('applicantId', ParseUUIDPipe) applicantId: string) {
    return this.applicants.get(applicantId);
  }

  @Put(':applicantId/goal')
  @HttpCode(200)
  @ApiOperation({ summary: "Set the applicant's goal / target program" })
  updateGoal(@Param('applicantId', ParseUUIDPipe) applicantId: string, @Body() dto: UpdateGoalDto) {
    return this.applicants.updateGoal(applicantId, dto);
  }
}
