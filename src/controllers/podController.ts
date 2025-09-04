import { Request, Response } from 'express';
import { PodService } from '../services/podService';
import { CreatePodRequest, UpdatePodRequest, PodSearchRequest } from '../models/Pod';

const podService = new PodService();

export const createPod = async (req: Request, res: Response): Promise<void> => {
  try {
    const podData: CreatePodRequest = req.body;
    const result = await podService.createPod(podData);
    res.status(201).json({
      success: true,
      message: 'Pod created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in createPod controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Pod creation failed'
    });
  }
};

export const updatePod = async (req: Request, res: Response): Promise<void> => {
  try {
    const podId = req.params.podId;
    if (!podId) {
      res.status(400).json({
        success: false,
        error: 'Pod ID is required'
      });
      return;
    }
    const updateData: UpdatePodRequest = req.body;
    const result = await podService.updatePod(podId, updateData);
    res.status(200).json({
      success: true,
      message: 'Pod updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in updatePod controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Pod update failed'
    });
  }
};

export const getPod = async (req: Request, res: Response): Promise<void> => {
  try {
    const podId = req.params.podId;
    if (!podId) {
      res.status(400).json({
        success: false,
        error: 'Pod ID is required'
      });
      return;
    }
    const result = await podService.getPodById(podId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getPod controller:', error);
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Pod not found'
    });
  }
};

export const getAllPods = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await podService.getAllPods(limit, offset);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getAllPods controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pods'
    });
  }
};

export const getPodsNearUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const searchData: PodSearchRequest = req.body;
    const result = await podService.getPodsNearUser(searchData);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getPodsNearUser controller:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    });
  }
};
