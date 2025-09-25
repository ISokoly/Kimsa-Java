import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OtrosComponent } from './otros.component';

describe('OtrosComponent', () => {
  let component: OtrosComponent;
  let fixture: ComponentFixture<OtrosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OtrosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OtrosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
