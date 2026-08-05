package app.tuzukin.diet;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Google Play のアプリ内課金（買い切り）。
 * 扱うのは app.tuzukin.diet.full ひとつだけ。
 * （体験用の ¥0 商品は Play では作れないため、体験期間の管理は JS 側の端末内で行う）
 */
@CapacitorPlugin(name = "Purchase")
public class PurchasePlugin extends Plugin {

    private BillingClient billing;
    /** 購入フローの結果を返すための保留中の呼び出し */
    private PluginCall pendingPurchaseCall;

    private final PurchasesUpdatedListener purchasesUpdatedListener = (result, purchases) -> {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            // 承認待ち（コンビニ払い等）を「購入済み」にしないこと。
            // ここを取り違えると、支払われていないのに解除される。
            boolean anyPurchased = false;
            boolean anyPending = false;
            for (Purchase purchase : purchases) {
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    anyPurchased = true;
                    acknowledgeIfNeeded(purchase);
                } else if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    anyPending = true;
                }
            }
            if (anyPurchased) {
                resolvePending("purchased");
            } else if (anyPending) {
                resolvePending("pending");
            } else {
                resolvePending("failed");
            }
            // アプリの外で確定した purchase（承認待ちが後から通った等）を JS に知らせる
            notifyListeners("purchasesUpdated", new JSObject());
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            resolvePending("cancelled");
        } else {
            resolvePending("failed");
        }
    };

    @Override
    public void load() {
        billing = BillingClient
                .newBuilder(getContext())
                .setListener(purchasesUpdatedListener)
                .enablePendingPurchases()
                .build();
    }

    @Override
    protected void handleOnDestroy() {
        if (billing != null) {
            billing.endConnection();
            billing = null;
        }
    }

    // ---- 接続 ----

    private interface Ready {
        void run(boolean ok);
    }

    private void withConnection(Ready then) {
        if (billing == null) {
            then.run(false);
            return;
        }
        if (billing.isReady()) {
            then.run(true);
            return;
        }
        billing.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                then.run(result.getResponseCode() == BillingClient.BillingResponseCode.OK);
            }

            @Override
            public void onBillingServiceDisconnected() {
                // 次の呼び出しでつなぎ直す
            }
        });
    }

    // ---- JS から呼ばれるメソッド ----

    @PluginMethod
    public void getProducts(PluginCall call) {
        JSArray idsArray = call.getArray("ids");
        List<String> ids = new ArrayList<>();
        if (idsArray != null) {
            try {
                ids = idsArray.toList();
            } catch (org.json.JSONException e) {
                ids = new ArrayList<>();
            }
        }

        final List<String> targetIds = ids;
        withConnection(ok -> {
            if (!ok) {
                call.resolve(new JSObject().put("products", new JSArray()));
                return;
            }
            List<QueryProductDetailsParams.Product> products = new ArrayList<>();
            for (String id : targetIds) {
                products.add(
                        QueryProductDetailsParams.Product
                                .newBuilder()
                                .setProductId(id)
                                .setProductType(BillingClient.ProductType.INAPP)
                                .build()
                );
            }
            if (products.isEmpty()) {
                call.resolve(new JSObject().put("products", new JSArray()));
                return;
            }
            QueryProductDetailsParams params = QueryProductDetailsParams
                    .newBuilder()
                    .setProductList(products)
                    .build();
            billing.queryProductDetailsAsync(params, (result, details) -> {
                JSArray out = new JSArray();
                if (details != null) {
                    for (ProductDetails detail : details) {
                        ProductDetails.OneTimePurchaseOfferDetails offer =
                                detail.getOneTimePurchaseOfferDetails();
                        if (offer == null) continue;
                        JSObject item = new JSObject();
                        item.put("id", detail.getProductId());
                        item.put("price", offer.getFormattedPrice());
                        out.put(item);
                    }
                }
                call.resolve(new JSObject().put("products", out));
            });
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("商品IDが指定されていません");
            return;
        }
        if (pendingPurchaseCall != null) {
            // 購入フローが二重に走ると、前の呼び出しが宙に浮く
            call.resolve(new JSObject().put("status", "failed"));
            return;
        }

        withConnection(ok -> {
            if (!ok) {
                call.resolve(new JSObject().put("status", "failed"));
                return;
            }
            QueryProductDetailsParams params = QueryProductDetailsParams
                    .newBuilder()
                    .setProductList(Collections.singletonList(
                            QueryProductDetailsParams.Product
                                    .newBuilder()
                                    .setProductId(id)
                                    .setProductType(BillingClient.ProductType.INAPP)
                                    .build()
                    ))
                    .build();

            billing.queryProductDetailsAsync(params, (result, details) -> {
                if (details == null || details.isEmpty()) {
                    call.resolve(new JSObject().put("status", "failed"));
                    return;
                }
                BillingFlowParams flowParams = BillingFlowParams
                        .newBuilder()
                        .setProductDetailsParamsList(Collections.singletonList(
                                BillingFlowParams.ProductDetailsParams
                                        .newBuilder()
                                        .setProductDetails(details.get(0))
                                        .build()
                        ))
                        .build();

                // 結果は purchasesUpdatedListener 側で返す
                pendingPurchaseCall = call;
                call.setKeepAlive(true);
                // launchBillingFlow はメインスレッドから呼ぶ決まり。
                // queryProductDetailsAsync のコールバックがメインとは限らない。
                getActivity().runOnUiThread(() -> {
                    BillingResult launched =
                            billing.launchBillingFlow(getActivity(), flowParams);
                    if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        resolvePending("failed");
                    }
                });
            });
        });
    }

    @PluginMethod
    public void restore(PluginCall call) {
        owned(call);
    }

    @PluginMethod
    public void owned(PluginCall call) {
        withConnection(ok -> {
            if (!ok) {
                call.resolve(new JSObject().put("owned", new JSArray()));
                return;
            }
            QueryPurchasesParams params = QueryPurchasesParams
                    .newBuilder()
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build();
            billing.queryPurchasesAsync(params, (result, purchases) -> {
                JSArray out = new JSArray();
                if (purchases != null) {
                    for (Purchase purchase : purchases) {
                        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
                            continue;
                        }
                        acknowledgeIfNeeded(purchase);
                        for (String productId : purchase.getProducts()) {
                            JSObject item = new JSObject();
                            item.put("id", productId);
                            item.put("purchasedAt", purchase.getPurchaseTime());
                            out.put(item);
                        }
                    }
                }
                call.resolve(new JSObject().put("owned", out));
            });
        });
    }

    // ---- 内部処理 ----

    /** 3日以内に承認しないと自動返金されるため、購入を見つけたら必ず承認する */
    private void acknowledgeIfNeeded(Purchase purchase) {
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        if (purchase.isAcknowledged()) return;
        if (billing == null) return;
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams
                .newBuilder()
                .setPurchaseToken(purchase.getPurchaseToken())
                .build();
        billing.acknowledgePurchase(params, result -> {
            // 失敗しても次回起動時の owned() で再度試みる
        });
    }

    private void resolvePending(String status) {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;
        if (call == null) return;
        call.setKeepAlive(false);
        call.resolve(new JSObject().put("status", status));
    }
}
