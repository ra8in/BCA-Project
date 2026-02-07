from rest_framework import serializers

class BuySellSerializer(serializers.Serializer):
    MODE_CHOICES = (('buy', 'Buy'), ('sell', 'Sell'))
    INVESTOR_CHOICES = (('individual', 'Individual'), ('institutional', 'Institutional'))
    PERIOD_CHOICES = (('short', 'Short Term'), ('long', 'Long Term'))

    mode = serializers.ChoiceField(choices=MODE_CHOICES)
    qty = serializers.IntegerField(min_value=1)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01)
    
    # Sell specific optional fields
    is_wacc_entry = serializers.BooleanField(default=False)
    purchase_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False)
    investor_type = serializers.ChoiceField(choices=INVESTOR_CHOICES, default='individual')
    holding_period = serializers.ChoiceField(choices=PERIOD_CHOICES, default='short')

class AdjustmentSerializer(serializers.Serializer):
    TYPE_CHOICES = (('bonus', 'Bonus'), ('right', 'Right'))
    type = serializers.ChoiceField(choices=TYPE_CHOICES)
    ltp = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01)
    percent = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    paid_up = serializers.DecimalField(max_digits=10, decimal_places=2, default=100)

class DividendSerializer(serializers.Serializer):
    qty = serializers.IntegerField(min_value=1)
    bonus_percent = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, default=0)
    cash_percent = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, default=0)
    face_value = serializers.DecimalField(max_digits=10, decimal_places=2, default=100)

class AveragingRowSerializer(serializers.Serializer):
    qty = serializers.IntegerField(min_value=1)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01)

class AveragingSerializer(serializers.Serializer):
    rows = AveragingRowSerializer(many=True)
