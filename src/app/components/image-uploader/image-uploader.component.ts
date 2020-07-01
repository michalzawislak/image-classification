import {Component, ElementRef, OnInit, Renderer2, ViewChild} from '@angular/core';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as cocoSSD from '@tensorflow-models/coco-ssd';
import * as use from '@tensorflow-models/universal-sentence-encoder';

import {Prediction} from "../../model/prediction";
import {MobileNet} from "@tensorflow-models/mobilenet";
import {KNNClassifier} from "@tensorflow-models/knn-classifier";
import {PredictionClass} from "../../model/predictionClass";
import {ObjectDetection} from "@tensorflow-models/coco-ssd";

@Component({
  selector: 'app-image-uploader',
  templateUrl: './image-uploader.component.html',
  styleUrls: ['./image-uploader.component.scss']
})
export class ImageUploaderComponent implements OnInit {
  imageSrc: string;
  classifiedImgScr: string;
  @ViewChild('img', {static: false}) imageEl: ElementRef;
  @ViewChild('classifiedImg', {static: false}) classifiedImage: ElementRef;
  @ViewChild('label', {static: false}) labelInput: ElementRef;
  @ViewChild('canvas', {static: false}) canvas: ElementRef;
  private video: HTMLVideoElement;

  public knnClassifier: KNNClassifier;
  public mobileNetModel: MobileNet;
  public useModel: any = tf.sequential();
  public use: any;
  public cocoSsd: ObjectDetection;
  public predictions: Prediction[];
  public loading: boolean = false;

  constructor() {
  }

  public async ngOnInit() {
    this.mobileNetModel = await mobilenet.load();
    this.knnClassifier = await knnClassifier.create();
    this.use = await use.load();
    this.cocoSsd = await cocoSSD.load({base: "lite_mobilenet_v2"});

    await this.webcam_init();

  }

  public async getClassifierImages(event) {
    const labelInput = this.labelInput.nativeElement;
    const label = labelInput.value;
    this.loading = true;
    if (event.target.files && event.target.files[0]) {
      const files = [...event.target.files];
      files.forEach((file, i) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (res: any) => {
          this.imageSrc = res.target.result;
          setTimeout(async () => {
            const imgEl = this.imageEl.nativeElement;
            this.predictions = await this.mobileNetModel.classify(imgEl);
            await this.addDatasetClass(imgEl, label);
            if (i === files.length - 1) this.loading = false;
          }, 0);
        };
      })
    }
  }

  public async saveClassifier(classifierModel) {
    this.loading = true;
    let dataset = classifierModel.getClassifierDataset()
    let datasetObject = {}
    Object.keys(dataset).forEach((key) => {
      let data = dataset[key].dataSync();
      datasetObject[key] = [...data];
    });

    let jsonModel = JSON.stringify(datasetObject)

    let downloader = document.createElement('a');
    downloader.download = "model.json";
    downloader.href = 'data:text/text;charset=utf-8,' + encodeURIComponent(jsonModel);
    document.body.appendChild(downloader);
    downloader.click();
    downloader.remove();
    this.loading = false;
  };

  public async uploadModel(classifierModel, event) {
    this.loading = true;
    let inputModel = event.target.files;
    let reader = new FileReader();
    if (inputModel.length > 0) {
      reader.onload = async () => {
        let dataset = reader.result as string;
        let tensorObj = JSON.parse(dataset);

        Object.keys(tensorObj).forEach((key) => {
          tensorObj[key] = tf.tensor(tensorObj[key], [tensorObj[key].length / 1024, 1024]);
        });
        classifierModel.setClassifierDataset(tensorObj);
      };
    }
    await reader.readAsText(inputModel[0]);
    this.loading = false;

  };

  public async addDatasetClass(img, label) {
    // @ts-ignore
    const activation = this.mobileNetModel.infer(img, 'conv_preds');
    this.knnClassifier.addExample(activation, label);
  };

  public async imageClassification(event) {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.readAsDataURL(event.target.files[0]);
      reader.onload = (res: any) => {
        this.classifiedImgScr = res.target.result;

        setTimeout(async () => {
          const imgEl = this.classifiedImage.nativeElement;
          if (this.knnClassifier.getNumClasses() > 0) {
            const activation = this.mobileNetModel.infer(imgEl, true);
            const result: PredictionClass = await this.knnClassifier.predictClass(activation);
            console.log(`prediction: ${result.label}, probability: ${result.confidences[result.label] * 100}%`);
          }
          await tf.nextFrame();
        }, 0);
      };
    }
  }

  public async detectOnImage(event) {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.readAsDataURL(event.target.files[0]);
      reader.onload = (res: any) => {
        this.classifiedImgScr = res.target.result;

        setTimeout(async () => {
          const imgEl = this.classifiedImage.nativeElement;
          let result = await this.cocoSsd.detect(imgEl);
          console.log(result)
        }, 0);
      };
    }
  }

  public async predictWithCocoModel() {
    this.detectFrame(this.video,this.cocoSsd);
  }

  public async webcam_init() {
    this.video = <HTMLVideoElement> document.getElementById("vid");

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: "user"
        }
      })
      .then(stream => {
        this.video.srcObject = stream;
        this.video.onloadedmetadata = () => {
          this.video.play().then(() => {
            this.predictWithCocoModel();
          });
        };
      });
  }

  public detectFrame (video, model) {
    model.detect(video).then(predictions => {
      this.renderPredictions(predictions);
      requestAnimationFrame(() => {
        this.detectFrame(video, model);
      });
    });
  }

  public renderPredictions (predictions) {
    const canvas = <HTMLCanvasElement> document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width  = 300;
    canvas.height = 300;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const font = "16px sans-serif";
    ctx.font = font;
    ctx.textBaseline = "top";
    ctx.drawImage(this.video,0, 0,300,300);

    predictions.forEach(prediction => {
      const x = prediction.bbox[0];
      const y = prediction.bbox[1];
      const width = prediction.bbox[2];
      const height = prediction.bbox[3];
      ctx.strokeStyle = "#00FFFF";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = "#00FFFF";
      const textWidth = ctx.measureText(prediction.class).width;
      const textHeight = parseInt(font, 10);
      ctx.fillRect(x, y, textWidth + 4, textHeight + 4);
    });

    predictions.forEach(prediction => {
      const x = prediction.bbox[0];
      const y = prediction.bbox[1];
      ctx.fillStyle = "#000000";
      ctx.fillText(prediction.class, x, y);
    });
  };
}
