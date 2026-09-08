import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioRepository } from './portfolio.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [PortfolioController],
  providers: [PortfolioRepository],
})
export class PortfolioModule {}
